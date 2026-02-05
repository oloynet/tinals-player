<?php

/*  ===============================================================
    SET VARIABLES
    =============================================================== */

    $is_display_date    = true;
    $is_display_time    = false;
    $is_display_place   = false;

    $is_debug           = false;
    $is_return_json     = true; // if return data (json OR debug) at the end of script

    $limit              = 0;    // 0 = all

    $festival_year      = '2026';
    $default_place      = 'Paloma Nîmes';

    $post_type          = array( 'event' );
    $post_status        = array( 'publish', 'private' );

    $is_new_audio       = false;
    $is_generate_mp3    = false;

    $allowed_text_tags  = '<b><strong><i><em><p><br>';


/*  ===============================================================
    FUNCTIONS
    =============================================================== */

    // ----- FUNCTION TO FIND wp-load.php SCRIPT

    function find_wp_load( $dir ) {
        $root = dirname( $dir );
        if ( $dir === $root ) {
            return false;
        }
        if ( file_exists( $dir . '/wp-load.php' ) ) {
            return $dir . '/wp-load.php';
        }

        return find_wp_load( $root );
    }

    // ----- FUNCTION TO GET WORDPRESS MEDIA INFO

    function get_media_info( $media_id ) {
        if ( ! $media_id ) return null;

        $meta       = wp_get_attachment_metadata( $media_id );
        $post_media = get_post( $media_id );

        return array(
            'id'          => $media_id,
            'url'         => wp_get_attachment_url( $media_id ),
            'title'       => strip_tags( $post_media->post_title ),
            'alt'         => strip_tags( get_post_meta( $media_id, '_wp_attachment_image_alt', true ) ),
            'description' => strip_tags( $post_media->post_content ),
            'filesize'    => isset( $meta['filesize'] ) ? $meta['filesize'] : 0,
            'duration'    => isset( $meta['length'] )   ? $meta['length']   : 0, // en secondes
            'width'       => isset( $meta['width'] )    ? $meta['width']    : 0,
            'height'      => isset( $meta['height'] )   ? $meta['height']   : 0,
        );
    }



/*  ===============================================================
    LOAD WORDPRESS BOOTLOADER : wp-load.php
    =============================================================== */

    $wp_load_path = false;

    // ----- if CLI

    if ( php_sapi_name() === 'cli' || empty( $_SERVER[ 'DOCUMENT_ROOT' ]) ) {
        $wp_load_path = find_wp_load( __DIR__ );
    }
    // ----- else APACHE
    else {
        $wp_load_path = ( file_exists( $_SERVER['DOCUMENT_ROOT'] . '/wp-load.php' ) )
            ?  $_SERVER['DOCUMENT_ROOT'] . '/wp-load.php'
            :  find_wp_load( __DIR__ );
    }

    // ----- LOAD wp-load.php

    if ( $wp_load_path ) {
        require_once( $wp_load_path );
    } else {
        die( "Error : Unable to find wp-load.php" );
    }


/*  ===============================================================
    QUERY WITH WPDB (WORDPRESS)
    =============================================================== */

    global $wpdb;

    $query   = '
        SELECT ID
            , post_title
            , wp_postmeta_year.meta_value                                       AS post_year
            #, wp_postmeta_start_date.meta_value                                AS post_start_unixtime
            #, FROM_UNIXTIME( wp_postmeta_start_date.meta_value )               AS post_start_datetime
            #, CAST(FROM_UNIXTIME( wp_postmeta_start_date.meta_value ) AS date) AS post_start_date
            , wp_posts.post_status                                              AS post_status
            , wp_postmeta_videos.meta_value                                     AS post_nb_videos
            , wp_postmeta_playlist_file.meta_value                              AS post_playlist_file

        FROM wp_posts

        INNER JOIN wp_postmeta AS wp_postmeta_year          ON (wp_postmeta_year.post_id          = wp_posts.id  AND  wp_postmeta_year.meta_key          = \'year\')
        # LEFT  JOIN wp_postmeta AS wp_postmeta_start_date  ON (wp_postmeta_start_date.post_id    = wp_posts.id  AND  wp_postmeta_start_date.meta_key    = \'start_date\')
        # LEFT  JOIN wp_postmeta AS wp_postmeta_end_date    ON (wp_postmeta_end_date.post_id      = wp_posts.id  AND  wp_postmeta_end_date.meta_key      = \'end_date\')
        LEFT  JOIN wp_postmeta AS wp_postmeta_videos        ON (wp_postmeta_videos.post_id        = wp_posts.id  AND  wp_postmeta_videos.meta_key        = \'videos\')
        LEFT  JOIN wp_postmeta AS wp_postmeta_playlist_file ON (wp_postmeta_playlist_file.post_id = wp_posts.id  AND  wp_postmeta_playlist_file.meta_key = \'playlist_file\')

        WHERE 1' .
            ( !empty( $post_type )   ? ' AND wp_posts.post_type                   IN ( \'' . implode( '\', \'', $post_type ) . '\')' : '' ) .
            ( !empty( $post_status ) ? ' AND wp_posts.post_status                 IN ( \'' . implode( '\', \'', $post_status ) . '\')' : '' ) .
            ( $festival_year         ? ' AND wp_postmeta_year.meta_value          =  \'' . $festival_year . '\'' : '' ) .
            ( $is_new_audio          ? ' AND wp_postmeta_playlist_file.meta_value IS NULL' : '' ) .
        ' ORDER BY wp_posts.menu_order' .
        ( $limit > 0 ? ' LIMIT ' . $limit : '' )
        ;

    $results = $wpdb->get_results( $query, OBJECT );

    //_log( '$query   = ' . print_r( $query, true ) );
    //_log( '$results = ' . print_r( $results, true ) );

    if ( ! empty( $wpdb->last_error ) ) {
        _log( '$wpdb->last_error = ' . print_r( $wpdb->last_error, true ) );
    }


/*  ===============================================================
    PARSE RESULTS
    =============================================================== */

    $json_data = array();

    $num_total = 0;
    $num_video = 0;

    foreach ( $results as $row ) {

        $num_total++;
        // $is_debug && _log( '$num_total = ' . print_r( $num_total, true ) );

        $id = $row->ID;

        // ----- GET POST

        $post = get_post( $id );
        do_action_ref_array( 'the_post', array( &$post ) );


        // ----- NAME & LINK

        $event_name = strtoupper( strip_tags( $row->post_title ) );
        $event_link = $post->link;

        // ----- STATUS

        $field_status = get_field_object( 'status', $id );

        if ( $field_status ) {
            $field_status_id    = $field_status['value'];
            $field_status_label = isset( $field_status['choices'][ $field_status_id ] ) ? $field_status['choices'][ $field_status_id ] : '';

            if( $field_status_id ) {

                $event_status = 'EventScheduled';

                $from = array(
                    'EventScheduled',
                    'EventCancelled',
                    'EventPostponed',
                    'EventRescheduled'
                );

                $to = array(
                    'scheduled',
                    'canceled',
                    'postponed',
                    'rescheduled'
                );

                $event_status = str_replace( $from, $to, $field_status_id  );
            }
        }


        // ----- TAXONOMY event_time

        $event_session     = '';
        $event_session_day = '';

        if( $is_display_date ) {

            $event_time_terms_all      = wp_get_post_terms( $id, 'event_time',  array( 'fields' => 'all' ) );
            $event_session_slug        = wp_list_pluck( $event_time_terms_all, 'slug' );
            $event_session_description = wp_list_pluck( $event_time_terms_all, 'description' );

            $event_session             = sanitize_title( !empty( $event_session_description )   ? $event_session_description[0]   : '' );
            $event_session_day         = sanitize_title( !empty( $event_session_slug  )         ? $event_session_slug [0]         : '' );
        }


        // ----- START DATE & END DATE

        $event_start_date = '';
        $event_end_date   = '';
        $event_start_time = '';
        $event_end_time   = '';
        $event_duration   = '';

        if( $is_display_date ) {

            $event_start_date = $post->start_date_Ymd;
            $event_end_date   = $post->end_date_Ymd;

            if( $is_display_time ) {

                $event_start_time       = $post->start_date_Hi;
                $event_end_time         = $post->end_date_Hi;

                if ( !empty($event_start_date) && !empty($event_start_time) && !empty($event_end_date) && !empty($event_end_time) ) {
                    $full_start       = $event_start_date . ' ' . $event_start_time . ':00';
                    $full_end         = $event_end_date   . ' ' . $event_end_time   . ':00';
                    $timestamp_start  = strtotime( $full_start );
                    $timestamp_end    = strtotime( $full_end );

                    if ( ( $duration = round( ( $timestamp_end - $timestamp_start ) / 60, 0 ) ) > 0 ) {
                        $event_duration = $duration;
                    }
                }
            }
        }


        // ----- CONTENT & DESCRIPTION

        $post_content         = strtoupper( sanitize_title_custom( strip_tags( $row->post_content, $allowed_text_tags ) ) );
        $description          = strip_tags( get_field( 'description',    $id ), $allowed_text_tags);
        $descriptionEN        = strip_tags( get_field( 'description_EN', $id ), $allowed_text_tags);


        // ----- TAXONOMY event_place

        $event_place          = $default_place;

        if( $is_display_place ) {
        $event_place_terms    = wp_get_post_terms( $id, 'event_place', array( 'fields' => 'names' ) );
        $event_place          = !empty( $event_place_terms ) ? $event_place_terms[0] : $default_place ;
        }


        // ----- TAXONOMY event_feel, event_genre, event_type, year, country

        $event_feel_terms     = wp_get_post_terms( $id, 'event_feel',  array( 'fields' => 'names' ) );
        $event_genre_terms    = wp_get_post_terms( $id, 'event_genre', array( 'fields' => 'names' ) );
        $event_type_terms     = wp_get_post_terms( $id, 'event_type',  array( 'fields' => 'names' ) );
        $year                 = strip_tags( get_field( 'year',    $id ) );
        $country              = strtoupper( get_field( 'country', $id ) );

        // ----- EVENT TAGS

        $event_tags           = array_merge( array(), $event_feel_terms, $event_genre_terms, array( $country ) );
        $event_tags           = array_map( 'ucfirst', $event_tags );

        // ----- OTHER TAGS

        $other_tags           = array_merge( array(), $event_type_terms, array( $year ) );
        $other_tags           = array_map( 'ucfirst', $other_tags );


        // ----- VIDEO

        $videos               = get_field( 'videos', $id );
        $video_url            = !empty( $videos ) ? $videos[0]['url'] : '';
        $video_title          = '';
        $video_timestart      = '0';
        $video_zoom           = '100%';


        // ----- AUDIO

        // $playlist_file     = get_field( 'playlist_file',   $id );
        $post_playlist_file   = $row->post_playlist_file;

        $audio_metas          = get_media_info( $post_playlist_file );
        $audio                = isset( $audio_metas['url'] )    ? $audio_metas['url']      : '';
        $audio_title          = isset( $audio_metas['title'] )  ? $audio_metas['title']    : '';


        // ----- IMAGES

        // $sizes             = get_intermediate_image_sizes();
        $images               = array();
        $images               = array_merge( $images, get_image_thumbnail() );
        $images               = array_merge( $images, get_images_to_array( 'thumbnail' ) );
        $images               = array_merge( $images, get_images_to_array( 'portfolio' ) );

        $image                = isset( $images[1] )            ? $images[1]['image']      : '';
        $image_thumbnail      = isset( $post->thumbnail_src )  ? $post->thumbnail_src[0]  : '';
        $image_mobile         = isset( $images[0] )            ? $images[0]['image']      : '';


        // ----- PERFORMER & SOCIAL NETWORKS

        $performer            = strip_tags( get_field( 'artist',  $id ) );
        $performer_website    = get_field( 'website',         $id ) ? get_field( 'website',         $id ) : '';
        $performer_youtube    = get_field( 'youtube_link',    $id ) ? get_field( 'youtube_link',    $id ) : '';
        $performer_facebook   = get_field( 'facebook',        $id ) ? get_field( 'facebook',        $id ) : '';
        $performer_instagram  = get_field( 'instagram_link',  $id ) ? get_field( 'instagram_link',  $id ) : '';
        $performer_tiktok     = get_field( 'tiktok_link',     $id ) ? get_field( 'tiktok_link',     $id ) : '';
        $performer_deezer     = get_field( 'deezer_link',     $id ) ? get_field( 'deezer_link',     $id ) : '';
        $performer_spotify    = get_field( 'spotify_link',    $id ) ? get_field( 'spotify_link',    $id ) : '';
        $performer_soundcloud = get_field( 'soundcloud_link', $id ) ? get_field( 'soundcloud_link', $id ) : '';

        if( 1 ) {
            $is_debug && _log( "" );
            $is_debug && _log( "---------------------------------------------------------------------" );
            $is_debug && _log( "" );

            $is_debug && _log( '$post                         = ' . print_r( $post, true ) );
            // $is_debug && _log( '$id                           = ' . print_r( $id, true ) );
            // $is_debug && _log( '$artist                       = ' . print_r( $artist    , true ) );
            $is_debug && _log( '$event_name                      = ' . print_r( $event_name    , true ) );

            // $is_debug && _log( '' );

            // $is_debug && _log( '$event_start_date             = ' . print_r( $event_start_date, true ) );
            // $is_debug && _log( '$event_start_time             = ' . print_r( $event_start_time, true ) );
            // $is_debug && _log( '$event_end_date               = ' . print_r( $event_end_date, true ) );
            // $is_debug && _log( '$event_end_time               = ' . print_r( $event_end_time, true ) );

            // $is_debug && _log( '' );

            // $is_debug && _log( '$full_start                   = ' . print_r( $full_start, true ) );
            // $is_debug && _log( '$full_end                     = ' . print_r( $full_end, true ) );
            // $is_debug && _log( '$timestamp_start              = ' . print_r( $timestamp_start, true ) );
            // $is_debug && _log( '$timestamp_end                = ' . print_r( $timestamp_end, true ) );
            // $is_debug && _log( '$event_duration               = ' . print_r( $event_duration, true ) );

            // $is_debug && _log( '' );

            // $is_debug && _log( '$event_time_terms_all         = ' . print_r( $event_time_terms_all, true ) );
            // $is_debug && _log( '$event_time_terms_description = ' . print_r( $event_time_terms_description, true ) );
            // $is_debug && _log( '$event_session_day            = ' . print_r( $event_session_day, true ) );
            // $is_debug && _log( '$event_session                = ' . print_r( $event_session, true ) );

            // $is_debug && _log( '' );

            $is_debug && _log( '$event_feel_terms                = ' . print_r( $event_feel_terms, true ) );
            $is_debug && _log( '$event_genre_terms               = ' . print_r( $event_genre_terms, true ) );
            $is_debug && _log( '$event_tags                      = ' . print_r( $event_tags, true ) );

            $is_debug && _log( '' );

            $is_debug && _log( '$event_type_terms                = ' . print_r( $event_type_terms, true ) );
            $is_debug && _log( '$year                            = ' . print_r( $year, true ) );
            $is_debug && _log( '$country                         = ' . print_r( $country   , true ) );
            $is_debug && _log( '$other_tags                      = ' . print_r( $other_tags, true ) );

            // $is_debug && _log( '$event_place_terms            = ' . print_r( $event_place_terms, true ) );
            // $is_debug && _log( '$event_place                  = ' . print_r( $event_place, true ) );



            // $is_debug && _log( '$videos                       = ' . print_r( $videos, true ) );
            // $is_debug && _log( '$video_url                    = ' . print_r( $video_url, true ) );

            // $is_debug && _log( '$playlist_file                = ' . print_r( $playlist_file, true ) );
            // $is_debug && _log( '$post_playlist_file           = ' . print_r( $post_playlist_file, true ) );
            // $is_debug && _log( '$audio_metas                  = ' . print_r( $audio_metas, true ) );
            // $is_debug && _log( '$audio                        = ' . print_r( $audio, true ) );
            // $is_debug && _log( '$audio_title                  = ' . print_r( $audio_title, true ) );

            // $is_debug && _log( '$image                        = ' . print_r( $image, true ) );
            // $is_debug && _log( '$image_thumbnail              = ' . print_r( $image_thumbnail, true ) );
            // $is_debug && _log( '$image_mobile                 = ' . print_r( $image_mobile, true ) );
        }


        // ----- JSON DATA

        $json_data[] = array(
            'id'                   => $id,
            'event_name'           => $event_name,
            'event_link'           => $event_link,
            'event_status'         => $event_status,

            'event_session'        => $event_session,
            'event_session_day'    => $event_session_day,

            'event_start_date'     => $event_start_date,
            'event_end_date'       => $event_start_time,
            'event_start_time'     => $event_end_date,
            'event_end_time'       => $event_end_time,
            'event_duration'       => $event_duration,

            'event_place'          => $event_place,
            'event_tags'           => $event_tags,

            'other_tags'           => $other_tags,

            'video_url'            => $video_url,
            '//video_title'        => $video_title,
            '//video_timestart'    => $video_timestart,
            '//video_zoom'         => $video_zoom,

            'audio'                => $audio,
            'audio_title'          => $audio_title,

            'image'                => $image,
            'image_thumbnail'      => $image_thumbnail,
            'image_mobile'         => $image_mobile,

            'description'          => $description,
            'descriptionEN'        => $descriptionEN,

            'performer'            => $performer,
            'performer_website'    => $performer_website,
            'performer_youtube'    => $performer_youtube,
            'performer_facebook'   => $performer_facebook,
            'performer_instagram'  => $performer_instagram,
            'performer_tiktok'     => $performer_tiktok,
            'performer_deezer'     => $performer_deezer,
            'performer_spotify'    => $performer_spotify,
            'performer_soundcloud' => $performer_soundcloud,
        );
    }

/*  ===============================================================
    RETURN JSON DATA
    =============================================================== */

    if( $is_return_data ) {
        exit();
    }

    if( $is_return_json ) {
        header( 'Content-Type: application/json; charset=utf-8' );
        echo json_encode( $json_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
        echo "\n";

    } else {
        _log( '$json_data = ' . print_r( $json_data, true ) );
        _log( sprintf( "%d item(s) \n", $num_total ) );
    }

    exit();
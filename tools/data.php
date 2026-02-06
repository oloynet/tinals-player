<?php

/*  ===============================================================
    SET VARIABLES
    =============================================================== */

    $is_display_date   = true;                          // PROD = true  | date_start, date_end, event_session, in results
    $is_display_time   = false;                         // PROD = true  | time_start, time_end in results
    $is_display_place  = false;                         // PROD = true  | event_place in results

    if( 1 ) {
        $is_debug          = false;                     // PROD = false |
        $is_return_data    = true;                      // PROD = true  | if return data at the end of script
        $is_return_json    = true;                      // PROD = true  | if return (json data OR debug) at the end of script

    } else {
        $is_debug          = true;                      // DEV = true   |
        $is_return_data    = false;                     // DEV = false  | if return data at the end of script
        $is_return_json    = true;                      // DEV = true   | if return (json data OR debug) at the end of script
    }

    $festival_year     = '2026';                        // year festival
    $default_place     = 'Paloma Nîmes';                // default place name

    $limit             = 0;                             // 0 = all
    $post_type         = array( 'event' );              // post_type   = 'event'
    $post_status       = array( 'publish', 'private' ); // post_status = 'publish' or 'private'

    $query_order       = 'start_date';                  // 'id', 'title', 'menu_order', 'year', 'is_teasing', 'showing_date', 'start_date', 'end_date', 'notoriety'

    $allowed_text_tags = '<b><strong><i><em><p><br>';


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


/* ===============================================================
   CONFIGURE ORDER SQL QUERY
   =============================================================== */

    $sql_order     = '';
    $meta_key_to_join = null;

    switch ( $query_order ) {
        case 'id':
            $sql_order = "wp_posts.ID ASC";
            break;

        case 'title':
            $sql_order = "wp_posts.post_title ASC";
            break;

        case 'menu_order':
            $sql_order = "wp_posts.menu_order ASC";
            break;

        case 'year':
            $sql_order = "wp_meta_year.meta_value ASC";
            break;

        case 'is_teasing':
        case 'showing_date':
        case 'start_date':
        case 'end_date':
        case 'notoriety':
            $meta_key_to_join = $query_order;
            $sql_order     = "wp_meta_{$query_order}.meta_value ASC, wp_posts.post_title ASC";
            break;

        default:
            $sql_order = "";
            break;
    }


/* ===============================================================
   CONSTRUCT SQL QUERY
   =============================================================== */

    $sql_select = array(
        "SELECT wp_posts.ID                  AS post_id",
        ", wp_posts.post_title               AS post_title",
        ", wp_posts.post_status              AS post_status",
        ", wp_meta_year.meta_value           AS post_year",
        ", wp_meta_playlist_file.meta_value  AS post_playlist_file",
        ", wp_meta_videos.meta_value         AS post_nb_videos"
    );

    $sql_from = array(
        "FROM wp_posts",
        "INNER JOIN wp_postmeta AS wp_meta_year          ON ( wp_meta_year.post_id          = wp_posts.ID  AND  wp_meta_year.meta_key          = 'year' )",
        "LEFT  JOIN wp_postmeta AS wp_meta_playlist_file ON ( wp_meta_playlist_file.post_id = wp_posts.ID  AND  wp_meta_playlist_file.meta_key = 'playlist_file' )",
        "LEFT  JOIN wp_postmeta AS wp_meta_videos        ON ( wp_meta_videos.post_id        = wp_posts.ID  AND  wp_meta_videos.meta_key        = 'videos' )"
    );

    if ( $meta_key_to_join ) {
        $alias = "wp_meta_" . $meta_key_to_join;
        $sql_from[] = "LEFT JOIN wp_postmeta AS {$alias} ON ( {$alias}.post_id = wp_posts.ID AND {$alias}.meta_key = '{$meta_key_to_join}' )";
    }

    $sql_where = array( "WHERE 1" );

    if ( !empty( $post_type ) ) {
        $types_str = implode( '", "', $post_type );
        $sql_where[] = "AND wp_posts.post_type IN ( \"{$types_str}\" )";
    }

    if ( !empty( $post_status ) ) {
        $status_str = implode( '", "', $post_status );
        $sql_where[] = "AND wp_posts.post_status IN ( \"{$status_str}\" )";
    }

    if ( $festival_year ) {
        $sql_where[] = "AND wp_meta_year.meta_value = \"{$festival_year}\"";
    }


    $sql = implode( "\n", array_merge( $sql_select, $sql_from, $sql_where ) );


    if ( $sql_order ) {
        $sql .= "\n ORDER BY " . $sql_order;
    }

    if ( $limit > 0 ) {
        $sql .= "\n LIMIT " . (int) $limit;
    }


/* ===============================================================
   EXECUTE SQL QUERY
   =============================================================== */

    // $is_debug && _log( '$sql   = ' . print_r( $sql, true ) );

    $results = $wpdb->get_results( $sql, OBJECT );

    if ( ! empty( $wpdb->last_error ) ) {
        _log( '$wpdb->last_error = ' . print_r( $wpdb->last_error, true ) );
        exit();
    }


/*  ===============================================================
    FETCH & PREPARE DATA
    =============================================================== */

    $json_data = array();

    $num_total = 0;
    $num_video = 0;

    foreach ( $results as $row ) {

        $num_total++;
        $id = $row->post_id;


        // ----- GET POST

        $post = get_post( $id );
        do_action_ref_array( 'the_post', array( &$post ) );


        // ----- NAME & LINK

        $event_name = strtoupper( strip_tags( $row->post_title ) );
        $event_link = str_replace( '.local', '.fr', $post->link );


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

                $event_start_time = $post->start_date_Hi;
                $event_end_time   = $post->end_date_Hi;

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
        $image_x              = '50';
        $image_y              = get_field( 'portfolio_position_y', $id ) ? get_field( 'portfolio_position_y', $id ) : '25';


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

        if( $is_debug ) {
            _log( "" );
            _log( "---------------------------------------------------------------------" );
            _log( "" );

            // _log( '$post                         = ' . print_r( $post, true ) );
            _log( '$id                              = ' . print_r( $id, true ) );
            // _log( '$artist                       = ' . print_r( $artist    , true ) );
            _log( '$event_name                      = ' . print_r( $event_name    , true ) );

            // _log( '' );

            _log( '$event_start_date                = ' . print_r( $event_start_date, true ) );
            // _log( '$event_start_time             = ' . print_r( $event_start_time, true ) );
            // _log( '$event_end_date               = ' . print_r( $event_end_date, true ) );
            // _log( '$event_end_time               = ' . print_r( $event_end_time, true ) );

            // _log( '' );

            // _log( '$full_start                   = ' . print_r( $full_start, true ) );
            // _log( '$full_end                     = ' . print_r( $full_end, true ) );
            // _log( '$timestamp_start              = ' . print_r( $timestamp_start, true ) );
            // _log( '$timestamp_end                = ' . print_r( $timestamp_end, true ) );
            // _log( '$event_duration               = ' . print_r( $event_duration, true ) );

            // _log( '' );

            // _log( '$event_time_terms_all         = ' . print_r( $event_time_terms_all, true ) );
            // _log( '$event_time_terms_description = ' . print_r( $event_time_terms_description, true ) );
            // _log( '$event_session_day            = ' . print_r( $event_session_day, true ) );
            // _log( '$event_session                = ' . print_r( $event_session, true ) );

            // _log( '' );

            // _log( '$event_feel_terms             = ' . print_r( $event_feel_terms, true ) );
            // _log( '$event_genre_terms            = ' . print_r( $event_genre_terms, true ) );
            // _log( '$event_tags                   = ' . print_r( $event_tags, true ) );

            // _log( '' );

            // _log( '$event_type_terms             = ' . print_r( $event_type_terms, true ) );
            // _log( '$year                         = ' . print_r( $year, true ) );
            // _log( '$country                      = ' . print_r( $country   , true ) );
            // _log( '$other_tags                   = ' . print_r( $other_tags, true ) );

            // _log( '$event_place_terms            = ' . print_r( $event_place_terms, true ) );
            // _log( '$event_place                  = ' . print_r( $event_place, true ) );

            // _log( '$videos                       = ' . print_r( $videos, true ) );
            // _log( '$video_url                    = ' . print_r( $video_url, true ) );

            // _log( '$playlist_file                = ' . print_r( $playlist_file, true ) );
            // _log( '$post_playlist_file           = ' . print_r( $post_playlist_file, true ) );
            // _log( '$audio_metas                  = ' . print_r( $audio_metas, true ) );
            // _log( '$audio                        = ' . print_r( $audio, true ) );
            // _log( '$audio_title                  = ' . print_r( $audio_title, true ) );

            // _log( '$image                        = ' . print_r( $image, true ) );
            // _log( '$image_thumbnail              = ' . print_r( $image_thumbnail, true ) );
            // _log( '$image_mobile                 = ' . print_r( $image_mobile, true ) );
            _log( '$image_x                         = ' . print_r( $image_x, true ) );
            _log( '$image_y                         = ' . print_r( $image_y, true ) );
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
            'image_x'              => $image_x,
            'image_y'              => $image_y,

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
    RETURN DATA (JSON or DEBUG)
    =============================================================== */

    if( $is_return_data ) {

        if( $is_return_json ) {
            header( 'Content-Type: application/json; charset=utf-8' );
            echo json_encode( $json_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
            echo "\n";

        } else {
            _log( '$json_data = ' . print_r( $json_data, true ) );
            _log( sprintf( "%d item(s) \n", $num_total ) );
        }

    }
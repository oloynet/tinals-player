<?php

/*  ===============================================================
    SET VARIABLES
    =============================================================== */

    $is_debug           = true;

    $limit              = 1;
    $is_return_json     = false;
    $festival_year      = "2026";
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

        $url  = wp_get_attachment_url( $media_id );
        $meta = wp_get_attachment_metadata( $media_id );
        $post = get_post( $media_id );
        $alt  = get_post_meta( $media_id, '_wp_attachment_image_alt', true );

        return array(
            'id'          => $media_id,
            'url'         => $url,
            'title'       => $post->post_title,
            'alt'         => $alt,
            'description' => $post->post_content,
            // Infos techniques (utiles pour le player audio/vidéo)
            'filesize'    => isset($meta['filesize']) ? $meta['filesize'] : 0,
            'duration'    => isset($meta['length'])   ? $meta['length']   : 0, // en secondes
            'width'       => isset($meta['width'])    ? $meta['width']    : 0,
            'height'      => isset($meta['height'])   ? $meta['height']   : 0,
        );
    }



/*  ===============================================================
    LOAD WORDPRESS BOOTLOADER : wp-load.php
    =============================================================== */


    $wp_load_path = false;

    // ----- if CLI

    if ( php_sapi_name() === 'cli' || empty($_SERVER['DOCUMENT_ROOT']) ) {
        $wp_load_path = find_wp_load( __DIR__ );
    }
    // ----- else APACHE
    else {
        if ( file_exists( $_SERVER['DOCUMENT_ROOT'] . '/wp-load.php' ) ) {
            $wp_load_path = $_SERVER['DOCUMENT_ROOT'] . '/wp-load.php';
        } else {
            $wp_load_path = find_wp_load( __DIR__ );
        }
    }

    // ----- LOAD wp-load.php

    if ( $wp_load_path ) {
        require_once( $wp_load_path );
    } else {
        die( "Erreur : Impossible de localiser wp-load.php" );
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
            ( !empty( $post_type )   ? ' AND wp_posts.post_type   IN ( \'' . implode( '\', \'', $post_type ) . '\')' : '' ) .
            ( !empty( $post_status ) ? ' AND wp_posts.post_status IN ( \'' . implode( '\', \'', $post_status ) . '\')' : '' ) .
            ( $festival_year         ? ' AND wp_postmeta_year.meta_value = \'' . $festival_year . '\'' : '' ) .
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

        // ----- GET CUSTOM FIELDS

        $event_name             = strtoupper( strip_tags( $row->post_title ) );
        $event_status           = 'scheduled';

        // $post_year           = $row->post_year;
        // $post_start_unixtime = $row->post_start_unixtime;
        // $post_start_datetime = $row->post_start_datetime;
        // $post_start_date     = $row->post_start_date;
        // $start_date          = get_field( 'start_date',      $id );
        // $end_date            = get_field( 'end_date',        $id );

        $year                   = get_field( 'year',            $id );

        $event_start_date       = $post->start_date_Ymd;
        $event_start_time       = $post->start_date_Hi;

        $event_end_date         = $post->end_date_Ymd;
        $event_end_time         = $post->end_date_Hi;

        $event_duration         = '';

        if ( !empty($event_start_date) && !empty($event_start_time) && !empty($event_end_date) && !empty($event_end_time) ) {

            $full_start       = $event_start_date . ' ' . $event_start_time . ':00';
            $full_end         = $event_end_date   . ' ' . $event_end_time   . ':00';

            $timestamp_start  = strtotime( $full_start );
            $timestamp_end    = strtotime( $full_end );

            $event_duration   = ( $timestamp_end - $timestamp_start ) / 60;
        }


        $post_content           = strtoupper( sanitize_title_custom( strip_tags( $row->post_content, $allowed_text_tags ) ) );
        $description            = strip_tags( get_field( 'description',    $id ), $allowed_text_tags);
        $descriptionEN          = strip_tags( get_field( 'description_EN', $id ), $allowed_text_tags);

        $artist                 = strip_tags( get_field( 'artist',  $id ) );
        $country                = strip_tags( get_field( 'country', $id ) );


        // ----- TAXONOMY event_time

        $event_time_terms_all   = wp_get_post_terms( $id, 'event_time',  array( 'fields' => 'all' ) );
        $event_slug             = wp_list_pluck( $event_time_terms_all, 'slug' );
        $event_description      = wp_list_pluck( $event_time_terms_all, 'description' );

        $event_session          = sanitize_title( !empty( $event_description ) ? $event_description[0] : '' );
        $event_day              = sanitize_title( !empty( $event_slug )        ? $event_slug[0]        : '' );


        // ----- TAXONOMY event_place

        $event_place_terms      = wp_get_post_terms( $id, 'event_place', array( 'fields' => 'names' ) );
        $event_place            = !empty( $event_place_terms ) ? $event_place_terms[0] : 'Paloma Nîmes';


        // ----- EVENT TAGS

        $event_feel_terms       = wp_get_post_terms( $id, 'event_feel',  array( 'fields' => 'names' ) );
        $event_genre_terms      = wp_get_post_terms( $id, 'event_genre', array( 'fields' => 'names' ) );

        $event_tags             = array();
        $event_tags             = array_merge( $event_tags, $event_feel_terms );
        $event_tags             = array_merge( $event_tags, $event_genre_terms );

        // ----- OTHER TAGS

        $event_type_terms       = wp_get_post_terms( $id, 'event_type',  array( 'fields' => 'names' ) );

        $other_tags             = array();
        $other_tags             = array_merge( $other_tags, $event_type_terms );
        $other_tags             = array_merge( $other_tags, $year );
        $other_tags             = array_merge( $other_tags, $country );

        // ----- VIDEO

        $videos                 = get_field( 'videos', $id );
        $video_url              = !empty( $videos ) ? $videos[0]['url'] : '';
        $video_title            = '';
        $video_timestart        = '0';
        $video_zoom             = '100%';

        // ----- AUDIO

        // $playlist_file       = get_field( 'playlist_file',   $id );
        $post_playlist_file     = $row->post_playlist_file;

        $audio_metas            = get_media_info( $post_playlist_file );
        $audio                  = isset( $audio_metas['url'] )    ? $audio_metas['url']      : '';
        $audio_title            = isset( $audio_metas['title'] )  ? $audio_metas['title']    : '';

        // ----- IMAGES

        // $sizes               = get_intermediate_image_sizes();
        $images                 = array();
        $images                 = array_merge( $images, get_image_thumbnail() );
        $images                 = array_merge( $images, get_images_to_array( 'thumbnail' ) );
        $images                 = array_merge( $images, get_images_to_array( 'portfolio' ) );

        $image                  = isset( $images[1] )            ? $images[1]['image']      : '';
        $image_thumbnail        = isset( $post->thumbnail_src )  ? $post->thumbnail_src[0]  : '';
        $image_mobile           = isset( $images[0] )            ? $images[0]['image']      : '';

        // ----- SOCIAL NETWORKS

        $performer_website      = get_field( 'website',         $id );
        $performer_youtube      = get_field( 'youtube_link',    $id );
        $performer_facebook     = get_field( 'facebook',        $id );
        $performer_instagram    = get_field( 'instagram_link',  $id );
        $performer_tiktok       = get_field( 'tiktok_link',     $id );
        $performer_deezer       = get_field( 'deezer_link',     $id );
        $performer_spotify      = get_field( 'spotify_link',    $id );
        $performer_soundcloud   = get_field( 'soundcloud_link', $id );


        if( 1 ) {
            $is_debug && _log( "" );
            $is_debug && _log( "---------------------------------------------------------------------" );
            $is_debug && _log( "" );

            // $is_debug && _log( '$post                         = ' . print_r( $post, true ) );
            // $is_debug && _log( '$id                           = ' . print_r( $id, true ) );
            // $is_debug && _log( '$artist                       = ' . print_r( $artist    , true ) );
            $is_debug && _log( '$event_name                      = ' . print_r( $event_name    , true ) );

            $is_debug && _log( '');

            $is_debug && _log( '$event_start_date                = ' . print_r( $event_start_date, true ) );
            $is_debug && _log( '$event_start_time                = ' . print_r( $event_start_time, true ) );
            $is_debug && _log( '$event_end_date                  = ' . print_r( $event_end_date, true ) );
            $is_debug && _log( '$event_end_time                  = ' . print_r( $event_end_time, true ) );

            $is_debug && _log( '');

            $is_debug && _log( '$full_start                     = ' . print_r( $full_start, true ) );
            $is_debug && _log( '$full_end                       = ' . print_r( $full_end, true ) );
            $is_debug && _log( '$timestamp_start                = ' . print_r( $timestamp_start, true ) );
            $is_debug && _log( '$timestamp_end                  = ' . print_r( $timestamp_end, true ) );
            $is_debug && _log( '$event_duration                 = ' . print_r( $event_duration, true ) );

            $is_debug && _log( '');

            // $is_debug && _log( '$event_time_terms_all         = ' . print_r( $event_time_terms_all, true ) );
            // $is_debug && _log( '$event_time_terms_description = ' . print_r( $event_time_terms_description, true ) );
            $is_debug && _log( '$event_day                       = ' . print_r( $event_day, true ) );
            $is_debug && _log( '$event_session                   = ' . print_r( $event_session, true ) );

            $is_debug && _log( '');

            // $is_debug && _log( '$event_feel_terms             = ' . print_r( $event_feel_terms, true ) );
            // $is_debug && _log( '$event_genre_terms            = ' . print_r( $event_genre_terms, true ) );
            // $is_debug && _log( '$event_type_terms             = ' . print_r( $event_type_terms, true ) );
            $is_debug && _log( '$event_tags                      = ' . print_r( $event_tags, true ) );
            $is_debug && _log( '$other_tags                      = ' . print_r( $other_tags, true ) );

            $is_debug && _log( '');

            // $is_debug && _log( '$event_place_terms            = ' . print_r( $event_place_terms, true ) );
            $is_debug && _log( '$event_place                     = ' . print_r( $event_place, true ) );


            // $is_debug && _log( '$post_title                   = ' . print_r( $post_title, true ) );
            // $is_debug && _log( '$post_year                    = ' . print_r( $post_year, true ) );

            // $is_debug && _log( '$country                      = ' . print_r( $country   , true ) );

            // $is_debug && _log( '$videos                       = ' . print_r( $videos, true ) );
            $is_debug && _log( '$video_url                       = ' . print_r( $video_url, true ) );

            // $is_debug && _log( '$playlist_file                = ' . print_r( $playlist_file, true ) );
            // $is_debug && _log( '$post_playlist_file           = ' . print_r( $post_playlist_file, true ) );
            // $is_debug && _log( '$audio_metas                  = ' . print_r( $audio_metas, true ) );
            $is_debug && _log( '$audio                           = ' . print_r( $audio, true ) );
            $is_debug && _log( '$audio_title                     = ' . print_r( $audio_title, true ) );

            $is_debug && _log( '$image                           = ' . print_r( $image, true ) );
            $is_debug && _log( '$image_thumbnail                 = ' . print_r( $image_thumbnail, true ) );
            $is_debug && _log( '$image_mobile                    = ' . print_r( $image_mobile, true ) );
        }


        // ----- JSON DATA

        $json_data[] = array(
            'id'                        => $id,
            'event_name'                => $event_name,
            'event_status'              => $event_status,

            'event_session'             => $event_session,
            'event_day'                 => $event_day,

            'event_start_date'          => $event_start_date,
            'event_end_date'            => $event_start_time,
            'event_start_time'          => $event_end_date,
            'event_end_time'            => $event_end_time,
            'event_duration'            => $event_duration,

            'event_place'               => $event_place,
            'event_tags'                => $event_tags,

            'artist'                    => $artist,
            'other_tags'                => $other_tags,

            'video_url'                 => $video_url,
            '//video_title'             => $video_title,
            '//video_timestart'         => $video_timestart,
            '//video_zoom'              => $video_zoom,

            'audio'                     => $audio,
            'audio_title'               => $audio_title,

            'image'                     => $image,
            'image_thumbnail'           => $image_thumbnail,
            'image_mobile'              => $image_mobile,

            'description'               => $description,
            'descriptionEN'             => $descriptionEN,

            'performer_website'         => $performer_website,
            'performer_youtube_channel' => $performer_youtube,
            'performer_facebook'        => $performer_facebook,
            'performer_instagram'       => $performer_instagram,
            'performer_tiktok'          => $performer_tiktok,
            'performer_deezer'          => $performer_deezer,
            'performer_spotify'         => $performer_spotify,
            'performer_soundcloud'      => $performer_soundcloud,
        );
    }

/*  ===============================================================
    RETURN JSON DATA
    =============================================================== */

    exit;

    if( $is_debug && true ) {
        _log( '$json_data = ' . print_r( $json_data, true ) );
        _log( sprintf( "%d item(s) \n", $num_total ) );

    } else {
        header( 'Content-Type: application/json; charset=utf-8' );
        echo json_encode( $json_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
        echo "\n";
    }
    exit();


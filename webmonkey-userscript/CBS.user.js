// ==UserScript==
// @name         CBS
// @description  Watch videos in external player.
// @version      1.1.0
// @match        *://cbs.com/*
// @match        *://*.cbs.com/*
// @icon         https://www.cbs.com/favicon.ico
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-CBS/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-CBS/issues
// @downloadURL  https://github.com/warren-bank/crx-CBS/raw/webmonkey-userscript/es5/webmonkey-userscript/CBS.user.js
// @updateURL    https://github.com/warren-bank/crx-CBS/raw/webmonkey-userscript/es5/webmonkey-userscript/CBS.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "common": {
    "rewrite_show_pages": true,
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": false,  // disable WebCast-Reloaded redirect until DRM headers can be embedded in URL
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- helpers

// make GET request, pass data to callback
var download_text = function(url, headers, callback) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          var text_data = xhr.responseText
          callback(text_data)
        }
        catch(e) {}
      }
    }
  }

  xhr.send()
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_data = function(data) {
  if (!data.referer_url)
    data.referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ data.video_url,
      /* type   = */ data.video_type
    ]

    // extras:
    if (data.caption_url) {
      args.push('textUrl')
      args.push(data.caption_url)
    }
    if (data.referer_url) {
      args.push('referUrl')
      args.push(data.referer_url)
    }
    if (data.drm.scheme) {
      args.push('drmScheme')
      args.push(data.drm.scheme)
    }
    if (data.drm.server) {
      args.push('drmUrl')
      args.push(data.drm.server)
    }
    if (data.drm.headers && (typeof data.drm.headers === 'object')) {
      var drm_header_keys, drm_header_key, drm_header_val

      drm_header_keys = Object.keys(data.drm.headers)
      for (var i=0; i < drm_header_keys.length; i++) {
        drm_header_key = drm_header_keys[i]
        drm_header_val = data.drm.headers[drm_header_key]

        args.push('drmHeader')
        args.push(drm_header_key + ': ' + drm_header_val)
      }
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(data.video_url, data.caption_url, data.referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_data = function(data) {
  data.video_type = 'application/x-mpegurl'
  process_video_data(data)
}

var process_dash_data = function(data) {
  data.video_type = 'application/dash+xml'
  process_video_data(data)
}

// ----------------------------------------------------------------------------- process video on current page

var process_video = function() {
  try {
    var data = {
      pid:         null,
      drm: {
        scheme:    "widevine",
        server:    null,
        headers:   null
      },
      referer_url: null,
      video_url:   null,
      video_type:  null,
      caption_url: null
    }

    var scripts = unsafeWindow.document.querySelectorAll('script:not([src])')
    var regex   = {
      whitespace: /[\r\n\t]+/g,
      json_data:  /^.*"pid"\s*:\s*"([^"]+)".*"widevine"\s*:\s*\{\s*"url"\s*:\s*("[^"]+")\s*,\s*"header"\s*:\s*(\{[^\}]+\}).*$/,
      smil_data:  /^.*?\<video\s+src="([^"]+)".*?\s+type="([^"]+)".*?\<param\s+name="webVTTCaptionURL"\s+value="([^"]*)".*$/
    }
    var script, matches

    for (var i=0; i < scripts.length; i++) {
      try {
        script = scripts[i]
        script = script.innerText.replace(regex.whitespace, ' ')

        matches = regex.json_data.exec(script)

        if (matches && matches.length) {
          data.pid         = matches[1]
          data.drm.server  = JSON.parse(matches[2])
          data.drm.headers = JSON.parse(matches[3])

          break
        }
      }
      catch(e2) {}
    }

    if (data.pid) {
      var xhr_url = "https://link.theplatform.com/s/dJ5BDC/" + data.pid + "?format=SMIL&manifest=m3u&Tracking=true&mbr=true"

      download_text(xhr_url, null, function(smil){
        smil = smil.replace(regex.whitespace, ' ')

        matches = regex.smil_data.exec(smil)

        if (matches && matches.length) {
          data.video_url   = matches[1]
          data.video_type  = matches[2]
          data.caption_url = matches[3]

          process_video_data(data)
        }
      })
    }
  }
  catch(e1) {}
}

// ----------------------------------------------------------------------------- rewrite DOM to display all available full-episodes for show

var pad_zeros = function(num, len) {
  var str = num.toString()
  var pad = len - str.length
  if (pad > 0)
    str = ('0').repeat(pad) + str
  return str
}

var rewrite_show_page = function() {
  if (!user_options.common.rewrite_show_pages) return

  var xhr_url = unsafeWindow.location.href.replace(new RegExp('[/]+$'), '') + '/xhr/episodes/page/0/size/18/xs/0/season/'

  download_text(xhr_url, null, function(json){
    try {
      var html, video
      var data = JSON.parse(json)

      if (data && (typeof data === 'object') && data.success) {
        data = data.result.data
               .filter(function(video){
                 return (video.type === 'Full Episode') && video.url && !video.is_paid_content && (video.status === 'AVAILABLE') && (video.lockLevel === 'none')
               })
               .map(function(video){
                 return {
                   url:          video.url,
                   season:       video.season_number  || 0,
                   episode:      video.episode_number || 0,
                   duration_sec: video.duration_raw   || 0,
                   title:        video.displayTitle || video.episode_title || video.label || video.title,
                   description:  video.description
                 }
               })

        if (Array.isArray(data) && data.length) {
          html = []

          html.push('<ul>')
          for (var i=0; i < data.length; i++) {
            video = data[i]

            html.push('<li><a target="_blank" href="' + video.url + '">' + ((video.season && video.episode) ? ('S' + pad_zeros(video.season, 2) + 'E' + pad_zeros(video.episode, 2) + ' ') : '') + video.title + '</a></li>')
          }
          html.push('</ul>')

          html = html.join("\n")

          unsafeWindow.document.body.innerHTML = html
        }
      }
    }
    catch(e) {}
  })
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  var pathname = unsafeWindow.location.pathname
  var is_video = (new RegExp('^/shows/[^/]+/video/.+$', 'i')).test(pathname)
  var is_show  = !is_video && (new RegExp('^/shows/[^/]+/?$', 'i')).test(pathname)

  if (is_video) process_video()
  if (is_show)  rewrite_show_page()
}

init()

// -----------------------------------------------------------------------------

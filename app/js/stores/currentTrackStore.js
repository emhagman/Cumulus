'use strict';

var _             = require('lodash')
var McFly         = require('../utils/mcfly')
var Dispatcher    = McFly.dispatcher
var playlistStore = require('./playlistStore')

var TrackStore

// Chromecast support
var remote = window.require('remote');
var Chromecasts = remote.require('chromecasts')();
var _chromecast = {
  device: null,
  interval: null,
  timeTicks: 0,
  remoteTime: 0,
  playing: false,
  paused: false,
  active: function() {
    return !!this.device;
  },
  disconnect: function() {
    if (this.device) {
      var _this = this;
      this.device.stop(function () {
        _this.device = null;
        _this.interval = null;
        _this.timeTicks = 0;
        _this.remoteTime = 0;
        _this.playing = false;
        _this.paused = false;
        TrackStore.emitChange();
      });
    }
  },
  reset: function (playing) {
    this.playing = playing;
    this.paused = false;
    this.remoteTime = 0;
    this.timeTicks = 0;
    this.interval = null;
  },
  pause: function() {
    if (this.device) {
      clearInterval(this.interval || -1);
      this.interval = null;
      this.device.pause();
      this.paused = true;
      this.playing = false;
      this.timeTicks = 0;
      TrackStore.emitChange();
    }
  },
  play: function(url, track) {
    if (this.device && this.paused && this.remoteTime > 0) {
      this.device.resume();
      this.paused = false;
      this.playing = true;
      this.setupTimer();
      TrackStore.emitChange();
    }
    if (this.device && url && _audio.src && track && track.title) {
      this.device.play(_audio.src, {title: track.title, type: 'audio/mp3'})
    }
  },
  seek: function (seconds) {
    if (this.device) {
      this.device.seek(seconds);
      this.remoteTime = seconds;
    }
  },
  setupTimer: function() {
    // Remote sync the current playback time every second
    // Local sync the time with a setInterval call
    var _this = this;
    if (this.interval) {
      return;
    }
    this.interval = setInterval(function () {

      if (!_this.device) {
        return;
      }

      // Every 10 seconds, remotely sync time from device
      if (_timeElapsedInterval % 10 === 0) {
        _this.device.status(function (err, status) {
          _this.remoteTime = status.currentTime;
          TrackStore.emitChange()
        })
      }

      // Every second add a second locally if we are playing
      _timeElapsedInterval += 1;
      if (_this.playing) {
        _this.remoteTime += 1;
        TrackStore.emitChange();
      }

    }, 1000);
  },
  listen: function() {
    var _this = this;
    this.device.on('status', function (status) {
      if (!_this.device) {
        return;
      }
      switch (status.playerState) {
        case 'PLAYING':

          // Reload all stats / status
          _this.reset(true);
          _setLoading(false);

          // Listen for initial status (time, etc)
          _this.device.status(function (err, status) {
            if (!_this.device) {
              return;
            }
            _this.remoteTime = status.currentTime
            TrackStore.emitChange()
          });

          _this.setupTimer();
          break;
      }
    });
  }
};
var _timeElapsedInterval = 0;

var _track = {}          // Current track information
var _audio = new Audio() // Current audio element

function _showNotification(track) {
  if (document.visibilityState !== 'hidden') return
  new window.Notification(track.user.username, {
    body : track.title,
    icon : track.artwork_url,
  })
}

function _setTrack(track) {
  _track = track

  _audio.src = track.stream_url
  _audio.load() // load the new stream source
  _showNotification(track)
}

function _selectChromecast(player) {
  _chromecast.device = player;
  TrackStore.emitChange()
}

function _disconnectChromecast() {
  _chromecast.disconnect();
  TrackStore.emitChange();
}

function _setLoading(bool) {
  _audio.loading = bool
  TrackStore.emitChange()
}

function _pause() {
  if (!_chromecast.active()) {
    _audio.pause()
  } else {
    _chromecast.pause();
  }
}

function _play(track) {
  if (track && track.id !== _track.id)
    _setTrack(track)
  if (!_chromecast.active()) {
    _audio.play()
  } else {
    _chromecast.listen();
    _chromecast.play(_audio.src, track);
  }
  TrackStore.emitChange()
}

function _seek(seconds) {
  _audio.currentTime = seconds
  if (_chromecast.active()) {
    _chromecast.seek(seconds);
  } else if (_audio.paused) {
    _play()
  }
}

function _nextTrack() {
  var nextTrack = playlistStore.getNextTrack()

  if (nextTrack)
  _play(nextTrack)
}

function _previousTrack() {
  var previousTrack = playlistStore.getPreviousTrack()

  if (previousTrack)
  _play(previousTrack)
}

function _toggleLikeTrack(track) {
  _track.user_favorite = !track.user_favorite
}

(function addListeners() {

  _audio.addEventListener('loadstart', function() {
    _setLoading(true)
  })
  _audio.addEventListener('waiting',   function() {
    _setLoading(true)
  })

  _audio.addEventListener('playing', function() {
    _setLoading(false)
  })

  _audio.addEventListener('error', function() {
    _setLoading(false)
    _nextTrack()
  })

  _audio.addEventListener('ended', function() {
    TrackStore.emitChange()
    _nextTrack()
  })

})()

TrackStore = McFly.createStore({

  getTrack: function() {
    return _track
  },

  getAudio: function() {
    return _audio
  },

  getChromecastPlayers: function() {
    return Chromecasts.players
  },

  getChromecast: function() {
    return _chromecast
  },

}, function(payload) {

  switch (payload.actionType) {

    case 'PLAY_TRACK':

      if (!payload.track && _.isEmpty(_audio.src))
        _play(playlistStore.getPlaylist()[0])
      else
        _play(payload.track)

      break

    case 'PAUSE_TRACK':
      _pause()
      break

    case 'SEEK_TRACK':
      _seek(payload.time)
      break

    case 'NEXT_TRACK':
      // wait for other stores to update first
      Dispatcher.waitFor([
        require('./feedStore').dispatcherID,
        require('./likesStore').dispatcherID,
        require('./playlistsStore').dispatcherID
      ])
      _nextTrack()
      break

    case 'PREVIOUS_TRACK':
      _previousTrack()
      break

    case 'LIKE_TRACK':
    case 'UNLIKE_TRACK':
      _toggleLikeTrack(payload.track)
      break

    case 'SELECT_CHROMECAST':
      _selectChromecast(payload.player);
      break

    case 'DISCONNECT_CHROMECAST':
      _disconnectChromecast();
      break;
  }

  TrackStore.emitChange()

  return true
});

module.exports = TrackStore

'use strict';

var McFly         = require('../utils/mcfly')
var Actions       = require('../actions/actionCreators')
var PlaylistStore = require('../stores/playlistStore')
var _             = require('lodash')

var _favorites    = []

function _setCollection(tracks) {
  _favorites = tracks
}

var LikesStore = McFly.createStore({

  getLikes: function() {
    return _favorites
  },

}, function(payload) {

  switch (payload.actionType) {

    case 'LOADED_COLLECTION':
      _setCollection(payload.collection)
      if (PlaylistStore.getPlaylist().length === 0)
        Actions.setPlaylist(payload.collection)
      break

  }

  LikesStore.emitChange()

  return true
});

module.exports = LikesStore

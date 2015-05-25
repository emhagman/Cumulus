'use strict';

var React             = require('react')
var ListItem          = require('./ListItem')

var classNames        = require('classnames')

var Actions           = require('../actions/actionCreators')
var FeedStore         = require('../stores/feedStore')
var CurrentTrackStore = require('../stores/currentTrackStore')

function getStateFromStores() {
  return {
    'feed'         : FeedStore.getFeed(),
    'loading'      : FeedStore.getFeed().length === 0,
    'currentTrack' : CurrentTrackStore.getTrack(),
    'currentAudio' : CurrentTrackStore.getAudio()
  }
}

var FeedView = React.createClass({

  getInitialState: function () {
    return getStateFromStores()
  },

  componentWillMount: function() {
    if (FeedStore.getFeed().length === 0)
      Actions.fetchFeed()

    FeedStore.addChangeListener(this._onChange)
    CurrentTrackStore.addChangeListener(this._onChange)
  },

  componentWillUnmount: function() {
    FeedStore.removeChangeListener(this._onChange)
    CurrentTrackStore.removeChangeListener(this._onChange)
  },

  _onChange: function() {
    this.setState(getStateFromStores())
  },

  render: function() {
    var state = this.state

    var classes = classNames({
      'content__view__feed' : true,
      'loading'             : this.state.loading
    })

    return (
      <div className={classes}>
        {this.state.feed.map(function(track) {

          var active  = state.currentTrack.id === track.id
          var paused  = active ? state.currentAudio.paused  : true
          var loading = active ? state.currentAudio.loading : false
          var error   = active ? state.currentAudio.error   : false

          return (
            <ListItem
              key     = { track.id }
              track   = { track }
              active  = { active }
              paused  = { paused }
              loading = { loading }
              error   = { error }
            >
            </ListItem>
          )
        })}
      </div>
    );
  }

});

module.exports = FeedView
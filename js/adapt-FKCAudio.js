define([
  "core/js/adapt",
  "core/js/views/componentView",
  "libraries/mediaelement-and-player",
  "libraries/mediaelement-and-player-accessible-captions",
  "libraries/mediaelement-fullscreen-hook"
], function(Adapt, ComponentView) {
  var FKCAudio = ComponentView.extend({
    preRender: function() {
      _.bindAll(
        this,
        "onMediaElementPlay",
        "onMediaElementPause",
        "onMediaElementEnded",
        "onMediaElementTimeUpdate",
        "onMediaElementSeeking"
      );

      // set initial player state attributes
      this.model.set({
        _isMediaEnded: false,
        _isMediaPlaying: false
      });

      if (this.model.get("_FKCAudio").source) {
        var media = this.model.get("_FKCAudio");

        media.source = media.source.replace(/^https?\:/, "");

        this.model.set("_FKCAudio", media);
      }

      this.checkIfResetOnRevisit();
    },

    postRender: function() {
      this.setupPlayer();
    },

    setupPlayer: function() {
      if (!this.model.get("_playerOptions"))
        this.model.set("_playerOptions", {});

      var modelOptions = this.model.get("_playerOptions");

      if (modelOptions.pluginPath === undefined)
        modelOptions.pluginPath = "assets/";

      modelOptions.success = _.bind(this.onPlayerReady, this);

      this.addThirdPartyFixes(
        modelOptions,
        _.bind(function createPlayer() {
          // create the player
          this.$("audio").mediaelementplayer(modelOptions);

          // We're streaming - set ready now, as success won't be called above
          try {
            if (this.model.get("_FKCAudio").source) {
              this.$(".FKCAudio-widget").addClass("external-source");
            }
          } catch (e) {
            console.log(
              "ERROR! No _FKCAudio property found in components.json for component " +
                this.model.get("_id")
            );
          } finally {
            this.setReadyStatus();
          }
        }, this)
      );
    },

    addThirdPartyFixes: function(modelOptions, callback) {
      var media = this.model.get("_FKCAudio");
      if (!media) return callback();

      callback();
    },

    setupEventListeners: function() {
      this.completionEvent = !this.model.get("_setCompletionOn")
        ? "play"
        : this.model.get("_setCompletionOn");

      if (this.completionEvent === "inview") {
        this.$(".component-widget").on("inview", _.bind(this.inview, this));
      }

      // wrapper to check if preventForwardScrubbing is turned on.
      if (
        this.model.get("_preventForwardScrubbing") &&
        !this.model.get("_isComplete")
      ) {
        $(this.mediaElement).on({
          seeking: this.onMediaElementSeeking,
          timeupdate: this.onMediaElementTimeUpdate
        });
      }

      // handle other completion events in the event Listeners
      $(this.mediaElement).on({
        play: this.onMediaElementPlay,
        pause: this.onMediaElementPause,
        ended: this.onMediaElementEnded
      });
    },

    onMediaElementPlay: function(event) {
      this.model.set({
        _isMediaPlaying: true,
        _isMediaEnded: false
      });

      if (this.completionEvent === "play") {
        this.setCompletionStatus();
      }
    },

    onMediaElementPause: function(event) {
      this.model.set("_isMediaPlaying", false);
    },

    onMediaElementEnded: function(event) {
      this.model.set("_isMediaEnded", true);

      if (this.completionEvent === "ended") {
        this.setCompletionStatus();
      }
    },

    onMediaElementSeeking: function(event) {
      var maxViewed = this.model.get("_maxViewed");
      if (!maxViewed) {
        maxViewed = 0;
      }
      if (event.target.currentTime > maxViewed) {
        event.target.currentTime = maxViewed;
      }
    },

    onMediaElementTimeUpdate: function(event) {
      var maxViewed = this.model.get("_maxViewed");
      if (!maxViewed) {
        maxViewed = 0;
      }
      if (event.target.currentTime > maxViewed) {
        this.model.set("_maxViewed", event.target.currentTime);
      }
    },

    // Overrides the default play/pause functionality to stop accidental playing on touch devices
    setupPlayPauseToggle: function() {
      // bit sneaky, but we don't have a this.mediaElement.player ref on iOS devices
      var player = this.mediaElement.player;

      if (!player) {
        console.log(
          "Media.setupPlayPauseToggle: OOPS! there's no player reference."
        );
        return;
      }

      // stop the player dealing with this, we'll do it ourselves
      player.options.clickToPlayPause = false;

      this.onOverlayClick = _.bind(this.onOverlayClick, this);
      this.onMediaElementClick = _.bind(this.onMediaElementClick, this);

      // play on 'big button' click
      this.$(".mejs-overlay-button").on("click", this.onOverlayClick);

      // pause on player click
      this.$(".mejs-mediaelement").on("click", this.onMediaElementClick);
    },

    onOverlayClick: function() {
      var player = this.mediaElement.player;
      if (!player) return;

      player.play();
    },

    onMediaElementClick: function(event) {
      var player = this.mediaElement.player;
      if (!player) return;

      var isPaused = player.media.paused;
      if (!isPaused) player.pause();
    },

    checkIfResetOnRevisit: function() {
      var isResetOnRevisit = this.model.get("_isResetOnRevisit");

      // If reset is enabled set defaults
      if (isResetOnRevisit) {
        this.model.reset(isResetOnRevisit);
      }
    },

    inview: function(event, visible, visiblePartX, visiblePartY) {
      if (visible) {
        if (visiblePartY === "top") {
          this._isVisibleTop = true;
        } else if (visiblePartY === "bottom") {
          this._isVisibleBottom = true;
        } else {
          this._isVisibleTop = true;
          this._isVisibleBottom = true;
        }

        if (this._isVisibleTop && this._isVisibleBottom) {
          this.$(".component-inner").off("inview");
          this.setCompletionStatus();
        }
      }
    },
    remove: function() {
      this.$(".mejs-overlay-button").off("click", this.onOverlayClick);
      this.$(".mejs-mediaelement").off("click", this.onMediaElementClick);

      var modelOptions = this.model.get("_playerOptions");
      delete modelOptions.success;

      if (this.mediaElement && this.mediaElement.player) {
        var player_id = this.mediaElement.player.id;

        purge(this.$el[0]);
        this.mediaElement.player.remove();

        if (mejs.players[player_id]) {
          delete mejs.players[player_id];
        }
      }

      if (this.mediaElement) {
        $(this.mediaElement).off({
          play: this.onMediaElementPlay,
          pause: this.onMediaElementPause,
          ended: this.onMediaElementEnded,
          seeking: this.onMediaElementSeeking,
          timeupdate: this.onMediaElementTimeUpdate
        });

        this.mediaElement.src = "";
        $(this.mediaElement.pluginElement).remove();
        delete this.mediaElement;
      }

      ComponentView.prototype.remove.call(this);
    },

    onPlayerReady: function(mediaElement, domObject) {
      this.mediaElement = mediaElement;

      if (!this.mediaElement.player) {
        this.mediaElement.player =
          mejs.players[this.$(".mejs-container").attr("id")];
      }

      if (this.model.has("_startVolume")) {
        // Setting the start volume only works with the Flash-based player if you do it here rather than in setupPlayer
        this.mediaElement.player.setVolume(
          parseInt(this.model.get("_startVolume")) / 100
        );
      }

      this.setReadyStatus();
      this.setupEventListeners();
    }
  });

  Adapt.register("FKCAudio", FKCAudio);

  return FKCAudio;
});

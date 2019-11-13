define([
  "core/js/adapt",
  "core/js/views/componentView",
  "libraries/mediaelement-and-player",
  "libraries/mediaelement-and-player-accessible-captions",
], function(Adapt, ComponentView) {
  var FKCAudio = ComponentView.extend({
    preRender: function() {
      _.bindAll(
        this,
        "onMediaElementPlay",
        "onMediaElementPause",
        "onMediaElementEnded"
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

    onPlayerReady: function(mediaElement, domObject) {
      this.mediaElement = mediaElement;

      if (!this.mediaElement.player) {
        this.mediaElement.player =
          mejs.players[this.$(".mejs-container").attr("id")];
      }

      this.setReadyStatus();
      this.setupEventListeners();
    }
  });

  Adapt.register("FKCAudio", FKCAudio);

  return FKCAudio;
});

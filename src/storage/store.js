import { Validator } from "jsonschema";
import merge from "deepmerge";
import Cookies from "js-cookie";
import jwtDecode from "jwt-decode";

const LOCAL_STORE_KEY = "___hubs_store";
const STORE_STATE_CACHE_KEY = Symbol();
const OAUTH_FLOW_CREDENTIALS_KEY = "ret-oauth-flow-account-credentials";
const validator = new Validator();
import { EventTarget } from "event-target-shim";
import { fetchRandomDefaultAvatarId, generateRandomName } from "../utils/identity.js";

// Durable (via local-storage) schema-enforced state that is meant to be consumed via forward data flow.
// (Think flux but with way less incidental complexity, at least for now :))
export const SCHEMA = {
  id: "/HubsStore",

  definitions: {
    profile: {
      type: "object",
      additionalProperties: false,
      properties: {
        displayName: { type: "string", pattern: "^[A-Za-z0-9 -]{3,32}$" },
        avatarId: { type: "string" },
        // personalAvatarId is obsolete, but we need it here for backwards compatibility.
        personalAvatarId: { type: "string" }
      }
    },

    credentials: {
      type: "object",
      additionalProperties: false,
      properties: {
        token: { type: ["null", "string"] },
        email: { type: ["null", "string"] }
      }
    },

    activity: {
      type: "object",
      additionalProperties: false,
      properties: {
        hasFoundFreeze: { type: "boolean" },
        hasChangedName: { type: "boolean" },
        hasAcceptedProfile: { type: "boolean" },
        lastEnteredAt: { type: "string" },
        hasPinned: { type: "boolean" },
        hasRotated: { type: "boolean" },
        hasRecentered: { type: "boolean" },
        hasScaled: { type: "boolean" },
        hasHoveredInWorldHud: { type: "boolean" },
        hasOpenedShare: { type: "boolean" },
        entryCount: { type: "number" }
      }
    },

    settings: {
      type: "object",
      additionalProperties: false,
      properties: {
        lastUsedMicDeviceId: { type: "string" }
      }
    },

    preferences: {
      type: "object",
      additionalProperties: false,
      properties: {
        shouldPromptForRefresh: { type: "bool" },
        preferredCamera: { type: "string" },
        muteMicOnEntry: { type: "bool" },
        audioOutputMode: { type: "string" },
        invertTouchscreenCameraMove: { type: "bool" },
        enableOnScreenJoystickLeft: { type: "bool" },
        enableOnScreenJoystickRight: { type: "bool" },
        onlyShowNametagsInFreeze: { type: "bool" },
        allowMultipleHubsInstances: { type: "bool" },
        disableIdleDetection: { type: "bool" },
        preferMobileObjectInfoPanel: { type: "bool" },
        maxResolutionWidth: { type: "number" },
        maxResolutionHeight: { type: "number" },
        globalVoiceVolume: { type: "number" },
        globalMediaVolume: { type: "number" },
        snapRotationDegrees: { type: "number" },
        materialQualitySetting: { type: "string" },
        disableSoundEffects: { type: "bool" },
        disableMovement: { type: "bool" },
        disableBackwardsMovement: { type: "bool" },
        disableStrafing: { type: "bool" },
        disableTeleporter: { type: "bool" },
        disableAutoPixelRatio: { type: "bool" },
        movementSpeedModifier: { type: "number" },
        disableEchoCancellation: { type: "bool" },
        disableNoiseSuppression: { type: "bool" },
        disableAutoGainControl: { type: "bool" }
      }
    },

    // Legacy
    confirmedDiscordRooms: {
      type: "array",
      items: { type: "string" }
    },

    confirmedBroadcastedRooms: {
      type: "array",
      items: { type: "string" }
    },

    uploadPromotionTokens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fileId: { type: "string" },
          promotionToken: { type: "string" }
        }
      }
    },

    creatorAssignmentTokens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          hubId: { type: "string" },
          creatorAssignmentToken: { type: "string" }
        }
      }
    },

    embedTokens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          hubId: { type: "string" },
          embedToken: { type: "string" }
        }
      }
    },

    onLoadActions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string" },
          args: { type: "object" }
        }
      }
    },

    mvpActions: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: ["null", "number"] },
        role: { type: ["null", "number"] },
        firstname: { type: ["null", "string"] },
        lastname: { type: ["null", "string"] },
        mtoken: { type: ["null", "string"] },
        waitingMethod: { type: "string" },
        photoURL: {type: ["null", "string"]},
        waitingAmount: { type: "number" },
        guestSignupError: { type: ["null", "string"] },
        loginError: {type: ["null", "string"]},
        signupError: {type: ["null", "string"]},
        isLoggedIn: {type: "boolean"},
        isSignedUp: {type: "boolean"},
        isWaiting: {type: "boolean"},
        uploadFailed: {type: "boolean"},
        assignRoomURL: {type: ["null", "string"]},
        assignAvatarId: {type: ["null", "string"]},
        assignoppositeAvatarID: {type: ["null", "string"]},
        assignuid: {type: ["null", "number"]},
        assignOppositeUserId: {type: ["null", "number"]},
        isAssigned: {type: "boolean"},
        demoType: {type: ["null", "number"]}
      }
    }
  },

  type: "object",

  properties: {
    profile: { $ref: "#/definitions/profile" },
    credentials: { $ref: "#/definitions/credentials" },
    activity: { $ref: "#/definitions/activity" },
    settings: { $ref: "#/definitions/settings" },
    preferences: { $ref: "#/definitions/preferences" },
    confirmedDiscordRooms: { $ref: "#/definitions/confirmedDiscordRooms" }, // Legacy
    confirmedBroadcastedRooms: { $ref: "#/definitions/confirmedBroadcastedRooms" },
    uploadPromotionTokens: { $ref: "#/definitions/uploadPromotionTokens" },
    creatorAssignmentTokens: { $ref: "#/definitions/creatorAssignmentTokens" },
    embedTokens: { $ref: "#/definitions/embedTokens" },
    onLoadActions: { $ref: "#/definitions/onLoadActions" },
    mvpActions: { $ref: "#/definitions/mvpActions" }
  },

  additionalProperties: false
};

export default class Store extends EventTarget {
  constructor() {
    super();

    if (localStorage.getItem(LOCAL_STORE_KEY) === null) {
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify({}));
    }

    // When storage is updated in another window
    window.addEventListener("storage", e => {
      if (e.key !== LOCAL_STORE_KEY) return;
      delete this[STORE_STATE_CACHE_KEY];
      this.dispatchEvent(new CustomEvent("statechanged"));
    });

    this.update({
      activity: {},
      settings: {},
      credentials: {},
      profile: {},
      confirmedDiscordRooms: [],
      confirmedBroadcastedRooms: [],
      uploadPromotionTokens: [],
      creatorAssignmentTokens: [],
      embedTokens: [],
      onLoadActions: [],
      preferences: {},
      mvpActions: {}
    });

    this._shouldResetAvatarOnInit = false;

    const oauthFlowCredentials = Cookies.getJSON(OAUTH_FLOW_CREDENTIALS_KEY);
    if (oauthFlowCredentials) {
      this.update({ credentials: oauthFlowCredentials });
      this._shouldResetAvatarOnInit = true;
      Cookies.remove(OAUTH_FLOW_CREDENTIALS_KEY);
    }

    this._signOutOnExpiredAuthToken();
  }

  _signOutOnExpiredAuthToken = () => {
    if (!this.state.credentials.token) return;

    const expiry = jwtDecode(this.state.credentials.token).exp * 1000;
    if (expiry <= Date.now()) {
      this.update({ credentials: { token: null, email: null } });
    }
  };

  initProfile = async () => {
    if (this._shouldResetAvatarOnInit) {
      await this.resetToRandomDefaultAvatar();
    } else {
      this.update({
        profile: { avatarId: await fetchRandomDefaultAvatarId(), ...(this.state.profile || {}) }
      });
    }

    // Regenerate name to encourage users to change it.
    if (!this.state.activity.hasChangedName) {
      this.update({ profile: { displayName: generateRandomName() } });
    }
  };

  resetToRandomDefaultAvatar = async () => {
    this.update({
      profile: { ...(this.state.profile || {}), avatarId: await fetchRandomDefaultAvatarId() }
    });
  };

  get state() {
    if (!this.hasOwnProperty(STORE_STATE_CACHE_KEY)) {
      this[STORE_STATE_CACHE_KEY] = JSON.parse(localStorage.getItem(LOCAL_STORE_KEY));
    }

    return this[STORE_STATE_CACHE_KEY];
  }

  get credentialsAccountId() {
    if (this.state.credentials.token) {
      return jwtDecode(this.state.credentials.token).sub;
    } else {
      return null;
    }
  }

  resetConfirmedBroadcastedRooms() {
    this.clearStoredArray("confirmedBroadcastedRooms");
  }

  resetTipActivityFlags() {
    this.update({
      activity: { hasRotated: false, hasPinned: false, hasRecentered: false, hasScaled: false, entryCount: 0 }
    });
  }

  bumpEntryCount() {
    const currentEntryCount = this.state.activity.entryCount || 0;
    this.update({ activity: { entryCount: currentEntryCount + 1 } });
  }

  // Sets a one-time action to perform the next time the page loads
  enqueueOnLoadAction(action, args) {
    this.update({ onLoadActions: [{ action, args }] });
  }

  executeOnLoadActions(sceneEl) {
    for (let i = 0; i < this.state.onLoadActions.length; i++) {
      const { action, args } = this.state.onLoadActions[i];

      if (action === "emit_scene_event") {
        sceneEl.emit(args.event, args.detail);
      }
    }

    this.clearOnLoadActions();
  }

  clearOnLoadActions() {
    this.clearStoredArray("onLoadActions");
  }

  clearStoredArray(key) {
    const overwriteMerge = (destinationArray, sourceArray) => sourceArray;
    const update = {};
    update[key] = [];

    this.update(update, { arrayMerge: overwriteMerge });
  }

  update(newState, mergeOpts) {
    const finalState = merge(this.state, newState, mergeOpts);
    const { valid } = validator.validate(finalState, SCHEMA);

    if (!valid) {
      // Intentionally not including details about the state or validation result here, since we don't want to leak
      // sensitive data in the error message.
      throw new Error(`Write to store failed schema validation.`);
    }

    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(finalState));
    delete this[STORE_STATE_CACHE_KEY];

    if (newState.profile !== undefined) {
      this.dispatchEvent(new CustomEvent("profilechanged"));
    }
    this.dispatchEvent(new CustomEvent("statechanged"));

    return finalState;
  }
}

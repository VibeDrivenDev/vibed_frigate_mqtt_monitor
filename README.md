# Vibed Frigate MQTT Monitor

A small desktop app for macOS and Windows. It shows your live camera feeds when [Frigate](https://frigate.video) detects a person. It hides each feed after a hold time that you set.

The app runs in the system tray. It has no main window. A floating feed window appears in a screen corner only when a camera has something to show.

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Install](#install)
- [First start](#first-start)
- [Using the app](#using-the-app)
- [Settings reference](#settings-reference)
- [The config file](#the-config-file)
- [Build installers](#build-installers)
- [Develop](#develop)
- [Troubleshooting](#troubleshooting)
- [Known limits](#known-limits)

## What it does

- Opens a live video tile for a camera when Frigate reports a person on that camera.
- Keeps the tile open while the person is detected.
- Keeps the tile open for a hold time after the detection ends. A countdown pie and a seconds counter show the time that remains.
- Resets the countdown when a new detection starts.
- Shows all active cameras in one grid. The grid never grows past a screen area that you choose. Tiles shrink as more cameras open.
- Lets you pin a camera so that it stays open all the time.
- Lets you click a tile to enlarge it.
- Can limit popups to Frigate zones, for all cameras or for one camera.
- Has no sound. The video has no audio.

## How it works

```
Frigate --MQTT--> broker --> this app --> feed window
   |                                          ^
   +-- go2rtc video (WebSocket, MSE) ---------+
   +-- HTTP API (camera list, events in progress)
```

1. The app subscribes to the MQTT topic `<prefix>/events`. The default prefix is `frigate`.
2. Each event message has a type (`new`, `update`, or `end`), a camera, a label, and a zone list.
3. A tracker keeps the state of each camera. A camera is visible while it has at least one active event that matches your rules.
4. When the last event on a camera ends, a hold timer starts. The tile closes when the timer ends.
5. The video comes from the go2rtc service inside Frigate. The app opens a WebSocket to `<frigate url>/live/mse/api/ws?src=<stream>`. It plays the stream with Media Source Extensions.
6. A snapshot from `<frigate url>/api/<camera>/latest.jpg` fills the tile while the video starts. The snapshot also serves as a fallback if the video fails three times in a row.
7. Every 20 seconds the app asks the Frigate API for the events in progress. This corrects two faults.
   - If the app missed an `end` message, it closes the stale tile. It waits 20 seconds first, so a brand new event is safe.
   - If the app missed a `new` message, it opens the tile.

## Requirements

- **Frigate** with MQTT enabled. The app was developed and tested against version 0.18.
- **go2rtc** enabled in Frigate. This is the default.
- An **MQTT broker** that the computer can reach on the network. The app does not support TLS.
- A computer with **macOS** (Apple silicon) or **Windows 11**.
- **Node.js**, only if you build or run the app from source. The app was developed with Node 26.

## Install

### From an installer

Build an installer with the steps in [Build installers](#build-installers). Then install it.

- **macOS.** Open the `.dmg` file. Drag the app into Applications.
- **Windows.** Run the `.exe` installer.

The app has no code signature. Your computer may warn you at the first start.

- **macOS.** Right-click the app. Choose Open. Choose Open again in the dialog. If that fails, run `xattr -cr "/Applications/Vibed Frigate MQTT Monitor.app"` once.
- **Windows.** In the SmartScreen dialog, choose "More info". Then choose "Run anyway".

### From source

```
npm install
npm start
```

## First start

The settings window opens by itself when a required setting is missing. A banner names the missing fields. Each missing field gets an orange outline.

The required settings are:

| Setting | Why |
|---|---|
| MQTT host and port | The app needs the broker address. |
| Frigate server URL | The app needs it for video, snapshots, and the camera list. |
| MQTT username and password | Needed unless you select "Broker needs no login". |

Fill in the fields. Press Save. The app connects at once. The tray menu shows `MQTT connected` when the connection works.

## Using the app

### The feed window

- The window stays on top of other windows. It does not take keyboard focus.
- It sits in a corner of one display. The default is the bottom right of the primary display.
- It has one tile for each visible camera. All tiles keep a 16:9 shape.
- Each tile shows the camera name at the bottom left.
- A countdown pie and a seconds number show the time until the tile closes. They appear only during the hold time.
- A pinned tile shows "Pinned" and has no countdown.

### Mouse actions on a tile

| Action | Result |
|---|---|
| Hover | The Pin and Close buttons appear at the top left. |
| Pin button | Pins the camera. A pinned camera stays open with no timer. The button then reads Unpin. |
| Close button | Closes the tile until the next new detection. Pinned tiles have no Close button. |
| Click the tile | Enlarges the tile to fill the feed area. The other tiles hide, and their timers keep running. A badge shows how many other cameras are open. |
| Click an enlarged tile, or press Esc | Returns to the grid. |

The enlarged view also ends by itself in two cases.

- The enlarged camera closes.
- A new detection starts on another camera. This way you do not miss a new person.

The window takes keyboard focus only while a tile is enlarged. This makes the Esc key work.

### The tray menu

| Item | What it does |
|---|---|
| `MQTT <status>` | Shows the connection state. You cannot click it. |
| Pause | Stops detection popups. Pinned cameras stay open. |
| Disable (pause and hide pinned) | Stops detection popups and hides all pinned cameras. Clear the check to show the pinned cameras again. The setting is not saved. The app starts enabled. |
| Show on display | Moves the feed window to the primary display or to another display. The app saves the choice. |
| Pin cameras... | Opens the pin picker. |
| Settings... | Opens the settings window. |
| Start at login | Starts the app when you log in. It is off by default. It works only in the installed app. |
| Quit | Quits the app. |

### The pin picker

The picker shows a live thumbnail for every camera. Click a camera to pin it. Click it again to unpin it. The window stays open, so you can pin several cameras in a row. Each click takes effect at once.

## Settings reference

Open the tray menu and choose "Settings...". Press Save to apply the changes. The app reconnects by itself.

### MQTT

| Field | Default | Meaning |
|---|---|---|
| Host | none | The address of the MQTT broker. |
| Port | `1883` | The broker port. |
| Broker needs no login | off | Skips the username and password. |
| Username | none | The broker user name. |
| Password | none | The broker password. Leave the field empty to keep the saved password. |
| Topic prefix | `frigate` | The Frigate MQTT topic prefix. |

The app saves the password in encrypted form. The encryption uses the system keychain through Electron `safeStorage`. If the keychain is not available, the app saves the password as plain text.

### Frigate

| Field | Default | Meaning |
|---|---|---|
| Server URL | none | The base URL of Frigate. Example: `https://frigate.example.lan`. |
| Stream name | `{camera}_sub_stream` | The go2rtc stream name for each camera. The text `{camera}` becomes the camera name. |

The stream name must match a stream in the `go2rtc` section of your Frigate config. Many setups use names like `front_door_sub_stream` and `front_door_main_stream`. The sub stream uses less bandwidth, so it suits a grid. To use a different stream for one camera, set `stream` for that camera in the config file.

### Detection (all cameras)

| Field | Default | Meaning |
|---|---|---|
| Labels | `person` | Object labels that open a tile. Separate them with commas. Example: `person, dog`. |
| Hold time (seconds) | `30` | How long a tile stays open after the last detection ends. |
| Zones | empty | Frigate zones that open a tile. An empty list means any zone. |

A zone filter matches a zone that the object is in now. It also matches a zone that the object entered during the event. Once an event matches, it stays open until it ends.

### Cameras

The table lists every camera from Frigate. Each row can override the global rules.

| Column | Meaning |
|---|---|
| On | Clear the check box to ignore a camera. |
| Hold (s) | A hold time for this camera. Empty means the global value. |
| Labels | Labels for this camera. Empty means the global value. |
| Zones | Zones for this camera. Empty means the global value. The grey hint text lists the zones that Frigate knows for the camera. |

### Window

| Field | Default | Meaning |
|---|---|---|
| Corner | `bottom-right` | The corner of the display where the feed window sits. |
| Max width (% of screen) | `33.3` | The widest the feed window can be. |
| Max height (% of screen) | `50` | The tallest the feed window can be. |
| Margin (pixels) | `16` | The gap between the window and the screen edge. |

The maximum width and height define the feed area. The defaults give one sixth of the screen. For example, `50` and `50` give a quarter of the screen.

The app measures the area on the usable part of the display. This part excludes the menu bar, the Dock, and the taskbar. For the current number of tiles, the app picks the number of columns that gives the largest 16:9 tiles inside the area. One camera fills the width of the area. More cameras make smaller tiles. The window never grows past the area.

To choose the display, use the tray item "Show on display".

### System

| Field | Default | Meaning |
|---|---|---|
| Start at login | off | Starts the installed app at login. |

## The config file

You do not need to edit the config file, because the settings window changes every option except the `stream` override of one camera. The app keeps its settings in `config.json`.

| System | Folder |
|---|---|
| macOS | `~/Library/Application Support/Vibed Frigate MQTT Monitor/` |
| Windows | `%APPDATA%\Vibed Frigate MQTT Monitor\` |

An example file:

```json
{
  "mqtt": {
    "host": "mqtt.example.lan",
    "port": 1883,
    "username": "frigate_viewer",
    "anonymous": false,
    "topicPrefix": "frigate"
  },
  "frigate": {
    "baseUrl": "https://frigate.example.lan",
    "streamTemplate": "{camera}_sub_stream"
  },
  "detection": {
    "labels": ["person"],
    "holdSeconds": 30,
    "zones": []
  },
  "cameras": {
    "garage": { "holdSeconds": 10, "zones": ["driveway"] },
    "side_gate": { "enabled": false },
    "front_door": { "stream": "front_door_main_stream" }
  },
  "pinned": ["front_door"],
  "window": {
    "display": "primary",
    "corner": "bottom-right",
    "maxWidth": 0.3333,
    "maxHeight": 0.5,
    "margin": 16
  },
  "startAtLogin": false
}
```

The `window.display` value is `"primary"` or the index of a display, starting at 0.

### Environment variables

| Variable | Meaning |
|---|---|
| `FRIGATE_MQTT_PASSWORD` | The MQTT password. It overrides the saved password. |
| `SURVEILLANCE_CONFIG` | The path to a config file. This is for development. |

The app also reads a `.env` file in the project folder and in the settings folder. Copy `.env.example` to `.env` to use it. Git ignores `.env`.

## Build installers

```
npm install
npm run dist:mac    # macOS, makes a .dmg in dist/
npm run dist:win    # Windows, makes an .exe installer in dist/
```

Build each installer on its own platform. Cross-building often fails.

## Develop

```
npm test        # unit tests
npm run demo    # a fake broker that sends person events
npm run icons   # redraws the icons in assets/
```

To try the app without real Frigate events, run the demo broker. It starts an MQTT broker on port 18830. It sends person events for a few cameras. In a second terminal, start the app against the demo config:

```
SURVEILLANCE_CONFIG=scripts/demo-config.json npm start
```

The demo config sets the broker address, a short hold time, and `anonymous`, so that the required settings check passes. The video and the snapshots still come from the Frigate server in your settings. Without a reachable server, tiles show no picture.

Other development variables:

| Variable | Meaning |
|---|---|
| `SURVEILLANCE_DEBUG` | Prints the camera list and each reconcile result. |
| `SURVEILLANCE_SHOT` | Writes a PNG of the feed window to this path, and then quits. |
| `SURVEILLANCE_SHOT_DELAY` | Milliseconds to wait before the screenshot. The default is 6000. |

### Project layout

| Path | Content |
|---|---|
| `src/main.js` | The main process. It owns the tray, the windows, the MQTT client, and the timers. |
| `src/tracker.js` | The pure state machine for cameras, events, hold timers, pins, and zones. |
| `src/layout.js` | The pure grid fit function. |
| `src/focus.js` | The pure rule for when the enlarged view ends. |
| `src/config.js` | Defaults, loading, saving, per-camera rules, and the required settings check. |
| `src/renderer/` | The feed window, the pin picker, and the settings window. |
| `scripts/` | The demo broker and the icon drawing script. |
| `test/` | Unit tests that use the Node test runner. |

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| The tray says `MQTT needs settings`. | A required setting is empty. Open Settings and fill the fields that have an orange outline. |
| The tray says `MQTT error: Connection refused: Not authorized`. | The user name or the password is wrong. |
| The tray keeps saying `disconnected`. | The broker address or port is wrong, the broker is down, or the computer is not on the same network. |
| Tiles open but show only a still picture. | The stream name does not match a go2rtc stream. Check the Stream name setting and the `go2rtc` section of your Frigate config. |
| A tile takes a few seconds to show video. | go2rtc needs time to open the camera stream. The snapshot fills the tile in the meantime. |
| No tile opens for a person. | Check Pause. Check the labels and zones. Check that the camera is switched on in the Cameras table. Check that Frigate publishes to the `<prefix>/events` topic. |
| The camera list in the pin picker is empty. | The app cannot reach the Frigate server URL. |
| The password is lost after a rename or a reinstall under a new app name. | The system keychain ties the saved password to the app name. Enter the password again in Settings. |

## Known limits

- The app does not support Frigate authentication. A browser WebSocket cannot send login headers. If you turn on authentication in Frigate, the video and the API calls fail.
- The MQTT connection does not support TLS.
- The app was tested on macOS only. It is not tested on Windows.
- The installers have no code signature.
- The app plays video only, with no audio.

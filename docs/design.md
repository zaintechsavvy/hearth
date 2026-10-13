# Hearth design rules

Hearth should feel like one product, not a pile of features. Every element answers three questions: why it is here, why it sits where it sits, and why it looks the way it does. When something new is added, it uses the rule below for its kind of thing, or the rule changes for everything at once.

## Places

Each thing has one home. Shortcuts may point at it, but they never become a second copy with its own controls.

| Thing | Home | Shortcuts that point at it |
| --- | --- | --- |
| Background, theme, accent | Settings, Appearance | Search: "Change the background" opens it |
| Your name, email, sign out, delete account | Settings, Account | The account menu (desktop) |
| Wall tablet | Settings, Wall tablet | The wall screen's own menu |
| Devices, scenes, widgets on the dashboard | The dashboard | Add tile, Edit |

**Why:** the same control in two places drifts apart and makes people wonder which one wins.

## Actions

- **One primary action per view**, as a solid dark button. It is the thing the view exists to do: Done while editing, Save in a dialog, New automation on Automations. Views about looking, like the dashboard at rest, Activity, and Settings, have no primary.
- **Secondary** (light, bordered) is for actions that add or start something: Add, Add tile in an empty state, Show earlier.
- **Ghost** (text only) is for Cancel and for small tools in a row or toolbar.
- **Placement:** a page's actions sit at the top right, beside the title. A section's add button sits at the right of the section heading, and under it on phones. A dialog's actions sit bottom right, Cancel first, the primary last. On phones a confirmation's actions fill the width, the hold button on top under the thumb.
- **Icons in buttons** are 16px; row icons 20px; empty states 24px. All icons use a 1.75 stroke.

## Removing and confirming

- **Removing something that takes more than a few seconds to make again asks first.** The button turns into its own question ("Remove Kitchen?") and a second press confirms. This covers connections, cameras, calendars, assistants, rooms, people, pages, scenes, automations, and tiles.
- **Quick list items are removed at once:** a reminder, a note, a timer, a colour. They are faster to retype than to confirm.
- **Hold to confirm is only for two things:** opening the home (unlocking a door, opening a garage) and deleting your account. Holding is deliberate, so a stray tap can't do either.
  - Opening the home is sensitive, not destructive, so its hold button is ink: outlined at rest, filling dark as you hold.
  - Deleting the account destroys data, so its hold button is red.
- **Red means data is lost.** Nothing else is red except errors.

## Text

| Role | Style | Where |
| --- | --- | --- |
| Page title | Display, 2xl to 3xl, 500 | Dashboard greeting, Activity, Automations, Settings |
| Page lede | Base, secondary | The line under every page title |
| Section title | Base, 500 | Settings sections, editor sections |
| Dialog title | Large, 500 | Every dialog and drawer |
| Group label | Extra small, 500, secondary | The small heading over a set of options: Presets, Devices, a day in Activity, a room in a list |
| Row title / row detail | Base 500 / small secondary | Settings rows, list rows |
| Field label | Small, 500 | Every input, select, and slider |

- Text in Settings never cuts off with an ellipsis. If it does not fit, it wraps, and if wrapping looks bad the words get shorter.
- Descriptions say what the section is for in one short line.

## Controls

- **Segmented control:** two to five fixed choices that are all worth seeing at once (Light, Dark, System).
- **Select:** a long or growing list (rooms, devices, accent).
- **Switch:** a setting that takes effect the moment it flips.
- **Checkbox:** picking items inside a form you then save (devices in a scene, pages a guest can see).
- **Room tabs on the dashboard** are the one place a growing list is a scrolling row of tabs: rooms are how you move around your home, so they stay one tap away.

## Surfaces

- **Glass panel:** anything that sits on the background and holds content: tiles, Settings groups, cards.
- **Glass sheet:** anything that floats above the page: dialogs, drawers, menus, popovers.
- Decoration never sits behind content. No glows or blobs inside panels; the background is the only colour field.

## Colour

- **Ink** (near black, or near white on dark backgrounds) for text and primary buttons.
- **Tokens only:** `--danger` for loss and errors, `--warning` for something that needs attention soon (a dose due, a timer ringing), `--success` for live and healthy. No hand-mixed reds or ambers.
- **Tile colours** are the device's own colour when it is on: a light's glow, a fan's teal. They carry state, not decoration.
- Text on a dark background turns light, grey text included.

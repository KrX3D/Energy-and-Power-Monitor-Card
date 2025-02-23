# Energy and Power Monitor Card

The **Energy and Power Monitor Card** is a custom Home Assistant card that works alongside the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration). It allows you to monitor and display energy and power consumption for different rooms or devices using a user-friendly configuration interface. You can set up and configure the card directly through the UI or using YAML.

---

## Features

- **Room Selection**:  
  Select a room from the list automatically fetched from the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration).

- **Display Options**:  
  Toggle the display of the room name and icon.

- **Untracked Values**:  
  Option to display untracked power/energy values separately.

- **Combine Values**:  
  When enabled, the card displays the combined value (tracked + untracked) in place of the tracked value.

- **Room Name Position**:  
  Choose whether to display the room name inside the circle or below it.

- **Remove Prefix**:  
  Remove specified prefix strings from child entity names.  
  Enter a semicolon-separated list (e.g. `1 OG; Schlafzimmer; Arbeitszimmer`) and if a child’s name starts with any of these prefixes (followed by a space and additional text) the prefix is removed.

- **Levels to Display**:  
  Choose how many levels of the tree to show:
  - **All**: Show every level.
  - **Only Selected**: Show only the selected room.
  - **All Parents**: Show only nodes that have children (omit leaf nodes).
  - **1st Level Max**: Show only the selected room and its immediate children.

- **Color Untracked Label**:  
  Option to use the untracked color for the untracked value label.

- **Styling Options**:  
  Configure font sizes for tracked/untracked values and room names, as well as icon and circle sizes.

---

## Prerequisites

This card requires the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration) to be installed and properly configured in your Home Assistant instance.

---

## Installation

### Manual Installation

1. Copy the contents of this repository into your Home Assistant `config/www/community/energy-power-monitor-card/` directory.
2. Add the card to your Lovelace configuration:
   - Navigate to **Configuration > Dashboards > Resources** in Home Assistant.
   - Click **Add Resource** and enter the URL: `/local/energy-power-monitor-card.js`
   - Set the resource type to **JavaScript Module**.
3. Add the card to your dashboard using the Visual Editor or YAML mode.

### HACS Installation

1. In HACS, click on the three dots in the top right.
2. Select **Add a repository** and choose **Dashboard** as the type.
3. Enter the URL: `https://github.com/KrX3D/energy-power-monitor-card`
4. Install the repository via HACS and restart Home Assistant if necessary.
5. Add the card as a resource in your Lovelace configuration.

---

## Configuration Options

| Option                          | Type     | Default     | Description |
|---------------------------------|----------|-------------|-------------|
| **Select Room**                 | Dropdown | *(First room)* | Choose the room to display. Rooms are fetched from the Energy and Power Monitor Integration. |
| **Show Name**                   | Checkbox | `true`      | Toggle the display of the room name on the card. |
| **Show Icon**                   | Checkbox | `true`      | Toggle the display of the room icon. |
| **Show Untracked Values**       | Checkbox | `true`      | Toggle the display of untracked power/energy values. |
| **Combine Untracked Values**    | Checkbox | `false`     | When enabled, the card displays the sum of tracked and untracked values. |
| **Room Name Position**          | Dropdown | `below`     | Choose where to display the room name: `inside` or `below` the circle. |
| **Remove prefix (sep. by ';')**  | Text     | `""`        | Enter prefix strings to remove from child names if present at the start (followed by a space). |
| **Levels to Display**           | Dropdown | `all`       | Options: <br>**All** – show all levels. <br>**Only Selected** – show only the selected room. <br>**All Parents** – show only nodes that have children (omit leaf nodes). <br>**1st Level Max** – show only the selected room and its immediate children. |
| **Tracked Color**               | Color    | `#3CB371`   | Color for tracked values and circle border. |
| **Untracked Color**             | Color    | `#808080`   | Color for untracked values and (optionally) for the untracked label. |
| **Color Untracked Label**       | Checkbox | `false`     | When enabled, the untracked value label uses the untracked color. |
| **Tracked Value Size**          | Dropdown | `10.5px`    | Font size for the tracked value display. |
| **Untracked Value Size**        | Dropdown | `10.5px`    | Font size for the untracked value display. |
| **Room Name Size**              | Dropdown | `10.5px`    | Font size for the room name text. |
| **Icon Size**                   | Dropdown | `22px`      | Icon size for the room icon. |
| **Circle Size**                 | Dropdown | `80px`      | Diameter of the circle in pixels. |

---

## YAML Configuration Example

```yaml
type: custom:energy-power-monitor-card
room: sensor.living_room_energy
show_name: true
show_icon: true
show_untracked_values: true
combine_value_untracked: true
levels_to_show: all
remove_strings: "1 OG; Schlafzimmer; Arbeitszimmer"
tracked_color: "#3CB371"
untracked_color: "#808080"
color_untracked_label: false
room_name_position: below
tracked_value_size: 10.5px
untracked_value_size: 10.5px
room_name_size: 10.5px
icon_size: 22px
circle_size: 80px
```

## GUI Configuration

1. Go to **Dashboards** and click **Add Card**.
2. Select the **Energy and Power Monitor Card**.
3. In **General Options**, choose the room and toggle basic options (Show Name, Show Icon, Show Untracked Values, Combine Untracked Values).
4. In **Style Options**, adjust colors, font sizes, icon and circle sizes, room name position, specify prefix removals (using `;` as the separator), and select the levels to display.
5. Save your changes.

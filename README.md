# Energy and Power Monitor Card

The **Energy and Power Monitor Card** is a custom Home Assistant card that works alongside the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration). 
It allows you to monitor and display energy and power consumption for different rooms or devices using a user-friendly configuration interface. You can set up and configure the card directly through the UI or using YAML.

---

## Features

- **Room Selection**: Select a room from the list of rooms created in the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration).
- **Show/Hide Name**: Toggle the display of the room name on the card.
- **Show/Hide Icon**: Option to show or hide the icon associated with the room.
- **Show Untracked Values**: Display untracked power/energy values in a second row, such as devices that consume energy but are not actively monitored.
- **Show Combined Values**: Adds to the value (first row, if untracked values are shown) the value of the untracked sensor.
- **Clean Subelement Names**: Automatically removes the parent element's name from its subelement. For example, if you have a structure like "House > Bath," any subelements under "Bath" will have "Bath " removed from the beginning of their friendly names.
- **Show Children**: Option to show or hide child entities under the selected room.

---

## Prerequisites

This card requires the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration) to be installed and correctly set up in your Home Assistant instance.

---

## Configuration Options

The card includes a configuration GUI for easy setup. Below are the options you can configure:

- **Select Room**: 
  - Dropdown to select the room for which you want to display energy and power consumption. The rooms are fetched automatically from the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration).

- **Show Name**: 
  - Checkbox to toggle the visibility of the room name on the card.

- **Show Icon**: 
  - Checkbox to toggle the visibility of the icon associated with the room.

- **Show Untracked Values**: 
  - Checkbox to toggle the display of untracked power/energy values (second row).

- **Show Combined Values**: 
  - Checkbox to toggle the combination of untracked power/energy values.

- **Clean Subelement Names**: 
  - Checkbox to remove the parent name from subelement names (e.g., "Bath " from "Bath Subelement").

- **Show Children**: 
  - Checkbox to toggle the visibility of child entities under the selected room.

---

## Installation

### Manual

1. Copy the contents of this repository into your Home Assistant `config/www/community/energy-power-monitor-card/` directory.
2. Add the card to your Lovelace configuration:
   - Navigate to **Configuration > Dashboards > Resources** in the Home Assistant UI.
   - Click **Add Resource** and enter the following URL: `/local/energy-power-monitor-card.js`.
   - Set the resource type to **JavaScript Module**.
3. Use the card in your Lovelace dashboard by adding it through the Visual Editor or using YAML mode.

### HACS

1. This repository can also be added to HACS (Home Assistant Community Store):
   - In HACS, click on the three dots in the top right corner.
   - Select **"Add a repository"** and choose **"Dashboard"** as the type.
   - Enter the URL of this repository: `https://github.com/KrX3D/room-power-monitor-card`.

---

## Configuration

### YAML (optional)

```yaml
type: custom:energy-power-monitor-card
room: sensor.living_room_energy
show_name: true
show_icon: true
combine_value_untracked: true
clean_subelement_names: true
show_untracked_values: true
show_children: true
```

### GUI

1. Go to Dashboards and click on the Add Card button.
2. Search for or select the Energy and Power Monitor Card from the list of available cards.
3. Use the dropdown menu to select the desired room.
4. Toggle the checkboxes for the options:
    - Show Name: Show or hide the room name.
    - Show Icon: Show or hide the room icon.
    - Show Untracked Values: Show or hide untracked power/energy values.
    - Show Combined Values: Add untracked values to entity value.
    - Clean Subelement Names: Show or hide cleaned subelement names.
    - Show Children: Show or hide child entities.
5. Save your changes, and the card will be added to your dashboard.

---

## Troubleshooting

- Ensure that the [Energy and Power Monitor Integration](https://github.com/KrX3D/Energy-and-Power-Monitor-Integration) is installed and correctly set up before using this card.
- The card's JavaScript file is correctly placed in your /config/www/community folder.
- You have added the resource URL in your Dashboard settings under Resources.
- You are using the correct entity IDs in your configuration.

---

## Contributing

If you have suggestions for improvements or encounter any issues, please feel free to open an issue or submit a pull request.

import {
  LitElement,
  html,
  css
} from "https://unpkg.com/lit-element@2.3.1/lit-element.js?module";

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-power-monitor-card',
  name: 'Energy and Power Monitor',
  description: "Displays power states for selected rooms.",
  preview: false,
});

class EnergyandPowerMonitorCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      treeStructure: { type: Array },
      rooms: { type: Array },
    };
  }

  debugEnabled = false; // Set to false to disable logging

  debugLog(message) {
    if (this.debugEnabled) {
      console.log(message);
    }
  }

  setConfig(config) {
    this.debugLog('Setting config...');
    this.config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      clean_subelement_names: config.clean_subelement_names !== false,
      show_children: config.show_children !== false,
      // New style configuration defaults:
      tracked_color: config.tracked_color || "#3CB371", // mediumseagreen
      untracked_color: config.untracked_color || "#808080", // grey
      room_name_position: config.room_name_position || "inside", // "inside" or "below"
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "24px",
      circle_size: config.circle_size || "8em",
      ...config,
    };
    this.debugLog(`Config updated: ${JSON.stringify(this.config)}`);
    
    this.rooms = [];
    this._fetchRooms();
  }

  async _fetchRooms() {
    this.debugLog('Fetching rooms...');
    let entities = [];
    if (this.hass) {
      try {
        // Use the outer variable instead of shadowing it.
        entities = await this.hass.callWS({
          type: 'config/entity_registry/list'
        });
        this.debugLog(`Entities fetched: ${entities.length} found.`);
      } catch (error) {
        this.debugLog(`Error fetching rooms: ${error}`);
        return;
      }
    } else {
      this.debugLog('this.hass is not yet available.');
      return;
    }

    this.rooms = entities
      .filter(entity =>
        entity.entity_id.startsWith('sensor.energy_power_monitor_') &&
        !(this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id).toLowerCase().includes('untracked')
      )
      .map(entity => {
        let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
        friendlyName = friendlyName.replace(/ selected entities -/gi, '');
        friendlyName = friendlyName.replace(/ (Power|Energy)$/i, ''); // Remove " Power" or " Energy"
        this.debugLog(`Room processed: ${friendlyName}`);
        return {
          entity_id: entity.entity_id,
          friendly_name: friendlyName
        };
      })
      .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));

    this.debugLog(`Rooms updated: ${this.rooms.length} found.`);
    this.requestUpdate();
  }

  _createTreeView(entityId, level = 0, parentFriendlyNameToRemove = '') {
    this.debugLog(`Creating tree view for entity: ${entityId} at level ${level}`);
    const entityState = this.hass.states[entityId];
    if (!entityState || !entityState.attributes.selected_entities) {
      this.debugLog(`No selected entities found for ${entityId}`);
      return [];
    }

    const selectedEntities = entityState.attributes.selected_entities.filter(entity =>
      !entity.endsWith('_untracked_power') && !entity.endsWith('_untracked_energy')
    );

    let friendlyName = entityState.attributes.friendly_name || entityId;
    friendlyName = friendlyName.replace(/\s?(\b(selected entities - )?(power|leistung|energy|energie)\b)\s*$/i, '');

    const cleanSubelementNames = this.config.clean_subelement_names !== false;
    if (cleanSubelementNames) {
      if (level === 1) {
        parentFriendlyNameToRemove = friendlyName + ' ';
      } else if (level > 1) {
        if (parentFriendlyNameToRemove && friendlyName.startsWith(parentFriendlyNameToRemove)) {
          friendlyName = friendlyName.replace(new RegExp(`^${parentFriendlyNameToRemove}`), '');
          this.debugLog(`Cleaned friendly name for level ${level}: ${friendlyName}`);
        }
      }
    }
    
    const normalValue = parseFloat(entityState.state);
    let combinedValue = normalValue;
    this.debugLog(`normalValue: ${normalValue}`);
    this.debugLog(`combinedValue: ${combinedValue}`);
    const entityUnit = entityState.attributes.unit_of_measurement || '';

    const untrackedValue = this.getUntrackedEntityValue(entityId);
    this.debugLog(`untrackedValue: ${untrackedValue}`);
    
    if (untrackedValue !== null && !isNaN(untrackedValue)) {
      combinedValue += parseFloat(untrackedValue);
      this.debugLog(`combinedValue: ${combinedValue}`);
    }

    const baseValue = this.config.combine_value_untracked ? combinedValue : normalValue;
    this.debugLog(`baseValue: ${baseValue}`);
    const percentage = (untrackedValue > 0 && baseValue > 0) 
      ? Math.round((untrackedValue / baseValue) * 100) 
      : 0;

    this.debugLog(`Percentage of untrackedValue compared to normalValue: ${percentage}`);

    const treeStructure = [
      {
        entity_id: entityId,
        friendly_name: friendlyName,
        value: normalValue,
        unit: entityUnit,
        level: level,
        percentage: percentage,
        untrackedValue: untrackedValue
      }
    ];
  
    selectedEntities.forEach(childEntityId => {
      if (childEntityId.startsWith('sensor.energy_power_monitor_')) {
        this.debugLog(`Recursively creating tree view for child entity: ${childEntityId}`);
        const childTreeStructure = this._createTreeView(
          childEntityId,
          level + 1,
          cleanSubelementNames ? (level === 0 ? friendlyName + ' ' : parentFriendlyNameToRemove) : ''
        );
        treeStructure.push(...childTreeStructure);
      } else {
        if (this.config.show_children) {
          const childEntityState = this.hass.states[childEntityId];
          let childFriendlyName = childEntityState?.attributes?.friendly_name || childEntityId;
          childFriendlyName = childFriendlyName.replace(/\s?(\b(selected entities - )?(power|leistung|energy|energie)\b)\s*$/i, '');
          const childEntityValue = childEntityState?.state;
          const childEntityUnit = childEntityState?.attributes?.unit_of_measurement || '';

          if (cleanSubelementNames) {
            if (parentFriendlyNameToRemove && childFriendlyName.startsWith(parentFriendlyNameToRemove)) {
              childFriendlyName = childFriendlyName.replace(new RegExp(`^${parentFriendlyNameToRemove}`, 'i'), '');
              this.debugLog(`Cleaned child friendly name: ${childFriendlyName}`);
            }
          }

          const untrackedValue = this.getUntrackedEntityValue(childEntityId);
          this.debugLog(`child untrackedValue: ${untrackedValue}`);
  
          const percentage = untrackedValue > 0 && childEntityValue > 0 
            ? Math.round((untrackedValue / childEntityValue) * 100 )
            : 0;
  
          this.debugLog(`Percentage of untrackedValue compared to childEntityValue: ${percentage}`);

          treeStructure.push({
            entity_id: childEntityId,
            friendly_name: childFriendlyName,
            value: childEntityValue,
            unit: childEntityUnit,
            level: level + 1,
            percentage: percentage,
            untrackedValue: untrackedValue
          });
          this.debugLog(`Added child entity to tree structure: ${childFriendlyName}`);
        }
      }
    });
    return treeStructure;
  }

  isClickHandling = false;

  constructor() {
    super();
  }

  _handleEntityClick(entityId) {
    if (this.isClickHandling) return;
    this.isClickHandling = true;

    this.debugLog(`Handling click for entity: ${entityId}`);

    const event = new Event('hass-more-info', {
      composed: true,
    });
    event.detail = { entityId: entityId };
    this.dispatchEvent(event);
    
    this.debugLog(`Entity clicked: ${entityId}`);

    setTimeout(() => {
      this.isClickHandling = false;
    }, 100);
  }

  getUntrackedEntityValue(entityId) {
    this.debugLog(`Fetching untracked value for entity: ${entityId}`);
    if (entityId.endsWith('_power')) {
      return this.hass.states[entityId.replace(/_power$/, '_untracked_power')]?.state || null;
    } else if (entityId.endsWith('_energy')) {
      return this.hass.states[entityId.replace(/_energy$/, '_untracked_energy')]?.state || null;
    }
    return null;
  }

  splitAtNearestSpace(text, maxLineLength = 15) {
    this.debugLog(`Splitting text into lines: ${text}`);
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach((word) => {
      if ((currentLine + word).length > maxLineLength) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine.length) {
      lines.push(currentLine.trim());
    }

    this.debugLog(`Split text into lines: ${JSON.stringify(lines)}`);
    return lines;
  }

  _getBorderColor(percentage, untrackedValue) {
    const trackedColor = this.config.tracked_color || "#3CB371";
    const untrackedColor = this.config.untracked_color || "#808080";

    if (untrackedValue === null || isNaN(untrackedValue) || !this.config.show_untracked_values) {
      return `conic-gradient(from 0deg, ${trackedColor}, ${trackedColor}) border-box`;
    }

    if (percentage > 0 && this.config.show_untracked_values) {
      return `conic-gradient(from 0deg, ${untrackedColor} 0% ${percentage}%, ${trackedColor} ${percentage}% 100%) border-box`;
    }

    return `conic-gradient(from 0deg, ${trackedColor}, ${trackedColor}) border-box`;
  }

  _setCircleBackgrounds(treeStructure) {
    this.debugLog(`_setCircleBackgrounds function called`);
    const circles = this.renderRoot.querySelectorAll('.circle');
    this.debugLog(`circles: ${JSON.stringify(circles)}`);

    circles.forEach(circle => {
      const entityId = circle.getAttribute('data-entity-id');
      this.debugLog(`entityId: ${entityId}`);

      if (!Array.isArray(treeStructure)) {
        this.debugLog(`treeStructure is not defined or not an array: ${treeStructure}`);
        return;
      }

      const item = treeStructure.find(item => item.entity_id === entityId);
      this.debugLog(`item: ${JSON.stringify(item)}`);
      if (item) {
        const background = this._getBorderColor(item.percentage, item.untrackedValue);
        circle.style.setProperty('--circle-background', background);
        this.debugLog(`Setting --circle-background: ${background} for entity: ${item.friendly_name}`);
      }
    });
    this.debugLog(`_setCircleBackgrounds function ENDE`);
  }
      
  _renderTreeView(treeStructure) {
    this.debugLog('Rendering tree view...');
    const renderedEntities = new Set();

    const renderItems = (items, level = 0) => {
      this.debugLog(`Rendering tree items at level ${level}: ${JSON.stringify(items, null, 2)}`);
      return items.map(item => {
        if (renderedEntities.has(item.entity_id)) {
          this.debugLog(`Entity already rendered: ${item.entity_id}`);
          return '';
        }
        renderedEntities.add(item.entity_id);

        const roomState = this.hass.states[item.entity_id];
        const showIcon = this.config.show_icon && roomState.attributes.icon; 

        let normalValue = roomState ? parseFloat(roomState.state) || 0 : 0;
        this.debugLog(`normalValue: ${normalValue}`);
        let combinedValue = normalValue;
        const untrackedValue = this.getUntrackedEntityValue(item.entity_id);
        this.debugLog(`untrackedValue: ${untrackedValue}`);

        if (untrackedValue !== null && !isNaN(untrackedValue)) {
          combinedValue += parseFloat(untrackedValue);
        }

        if (this.config.combine_value_untracked) {
          normalValue = combinedValue;
          this.debugLog(`Combined value with untracked: ${normalValue}`);
        }

        const percentage = untrackedValue > 0 && normalValue > 0 
          ? Math.round((untrackedValue / normalValue) * 100 )
          : 0;
        this.debugLog(`Percentage: ${percentage}`);

        // Calculate border color based on percentage using our config colors.
        let borderColor = this._getBorderColor(percentage, untrackedValue);
        this.debugLog(`borderColor: ${borderColor}`);

        const showUntrackedValues = this.config.show_untracked_values !== false;
        const unit = roomState.attributes.unit_of_measurement || '';
        const normalDisplay = normalValue !== null ? `${normalValue} ${unit}` : '';
        const untrackedDisplay = showUntrackedValues && untrackedValue !== null
          ? `U: ${untrackedValue} ${unit}`
          : '';

        const childEntities = (roomState?.attributes.selected_entities || []).filter(childEntityId => 
          !childEntityId.endsWith('_untracked_power') && 
          !childEntityId.endsWith('_untracked_energy')
        );
        const sortedChildEntities = childEntities.sort((a, b) => {
          const friendlyNameA = this.hass.states[a]?.attributes?.friendly_name || a;
          const friendlyNameB = this.hass.states[b]?.attributes?.friendly_name || b;
          return friendlyNameA.localeCompare(friendlyNameB);
        });
        const hasChildren = sortedChildEntities.length > 0;
        const friendlyNameLines = this.splitAtNearestSpace(item.friendly_name);
        const friendlyNameDisplay = friendlyNameLines.map(line => html`<div class="friendly-name-line">${line}</div>`);

        return html`
          <div class="tree-item" style="padding-left: ${level * 20}px;" @click="${() => this._handleEntityClick(item.entity_id)}">
            <div class="circle" data-entity-id="${item.entity_id}">
              <div class="circle-content">
                ${showIcon ? html`<ha-icon class="icon" icon="${roomState.attributes.icon}"></ha-icon>` : ''}
                ${this.config.room_name_position === 'inside' && this.config.show_name 
                  ? html`<div class="room-name ${!showIcon ? 'no-icon' : ''}">${friendlyNameDisplay}</div>` 
                  : ''}
                <div class="entity-value">${normalDisplay}</div>
                ${untrackedDisplay ? html`<div class="untracked-value">${untrackedDisplay}</div>` : ''}
              </div>
            </div>
            ${this.config.room_name_position === 'below' && this.config.show_name 
              ? html`<div class="room-name" style="padding-top: 4px;">${friendlyNameDisplay}</div>` 
              : ''}
            ${hasChildren ? html`
              <div class="children">
                ${renderItems(
                  sortedChildEntities.map(childEntityId => {
                    const childItem = treeStructure.find(child => child.entity_id === childEntityId);
                    if (this.config.show_children || (childItem && childEntityId.startsWith('sensor.energy_power_monitor_'))) {
                      return {
                        entity_id: childEntityId,
                        friendly_name: childItem ? childItem.friendly_name : childEntityId,
                        value: childItem ? childItem.value : null,
                        unit: childItem ? childItem.unit : ''
                      };
                    }
                    return null;
                  }).filter(item => item !== null),
                  level + 1
                )}
              </div>
            ` : ''}
          </div>
        `;
      });
    };

    return renderItems(treeStructure);
  }

  _getStyleVariables() {
    return `
      --tracked-value-size: ${this.config.tracked_value_size};
      --untracked-value-size: ${this.config.untracked_value_size};
      --room-name-size: ${this.config.room_name_size};
      --icon-size: ${this.config.icon_size};
      --circle-size: ${this.config.circle_size};
      --circle-tracked-color: ${this.config.tracked_color};
      --circle-untracked-color: ${this.config.untracked_color};
    `;
  }

  render() {
    const selectedRoom = this.config.room;
    const roomState = selectedRoom ? this.hass.states[selectedRoom] : null;

    if (!roomState) {
      return html`<ha-card><div>No room selected.</div></ha-card>`;
    }

    const treeStructure = this._createTreeView(selectedRoom);
    this._setCircleBackgrounds(treeStructure);

    return html`
      <ha-card style="${this._getStyleVariables()}">
        <div class="container">
          <!-- Tree View Rendering -->
          <div class="tree-view">
            ${this._renderTreeView(treeStructure)}
          </div>
        </div>
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("energy-power-monitor-card-editor");
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .container {
        padding: 16px;
        text-align: center; 
      }
      .circle {
        position: relative;
        border-radius: 50%;
        display: inline-block;
        cursor: pointer;
        transition: background-color 0.3s;
        width: var(--circle-size, 8em);
        height: var(--circle-size, 8em);
        aspect-ratio: 1;
      }
      .circle::before {
        content: "";
        position: absolute;
        inset: 0; 
        border-radius: 50%;
        border: 4px solid transparent;
        background: var(--circle-background, var(--circle-tracked-color, #3CB371));
        -webkit-mask: 
          linear-gradient(#fff 0 0) padding-box, 
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
                mask-composite: exclude; 
        z-index: 0;
      }
      .circle-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100%;
        width: 100%;
        padding: 10px;
        white-space: normal;
        box-sizing: border-box;
      }
      .friendly-name-line {
        margin: 0;
        line-height: 1.4;
      }
      .room-name {
        margin: 0;
        font-size: var(--room-name-size, 10.5px);
        margin-bottom: 3px;
      }
      .icon {
        font-size: var(--icon-size, 24px);
        margin-bottom: 3.5px;
      }
      .room-value.no-icon {
        margin-top: 5px;
      }
      .tree-view {
        margin-top: 10px;
        text-align: left;
      }
      .tree-item {
        cursor: pointer;
        margin: 4px 0;
      }
      .children {
        margin-left: 20px;
        border-left: 2px solid var(--divider-color);
        padding-left: 10px;
      }
      .entity-value {
        flex: 0 1 auto;
        text-align: center;
        font-size: var(--tracked-value-size, 10.5px);
        line-height: 1.1;
        color: white;
        margin-bottom: 3px;
      }
      .untracked-value {
        flex: 0 1 auto;
        text-align: center;
        font-size: var(--untracked-value-size, 10.5px);
        line-height: 1.1;
        color: grey;
      }
    `;
  }
}

customElements.define('energy-power-monitor-card', EnergyandPowerMonitorCard);

class EnergyandPowerMonitorCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      treeStructure: { type: Array },
      rooms: { type: Array }
    };
  }

  setConfig(config) {
    this._config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      clean_subelement_names: config.clean_subelement_names !== false,
      show_children: config.show_children !== false,
      // New style configuration defaults:
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "inside",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "24px",
      circle_size: config.circle_size || "8em",
      ...config,
    };
    this.rooms = [];
    this._fetchRooms();
  }

  async _fetchRooms() {
    const entities = await this.hass.callWS({
      type: 'config/entity_registry/list'
    });

    this.rooms = entities
      .filter(entity =>
        entity.entity_id.startsWith('sensor.energy_power_monitor_') &&
        !(this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id).toLowerCase().includes('untracked')
      )
      .map(entity => {
        let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
        friendlyName = friendlyName.replace(/ selected entities -/gi, '').replace(/ (Power|Energy)$/i, '');
        return {
          entity_id: entity.entity_id,
          friendly_name: friendlyName
        };
      })
      .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));

    this.requestUpdate();
  }

  _roomChanged(ev) {
    const selectedRoom = ev.target.value;
    this._config = { ...this._config, room: selectedRoom };
    this.fireConfigChanged();
  }

  _toggleOption(ev) {
    const option = ev.target.name;
    let value;
    if (ev.target.type === 'checkbox') {
      value = ev.target.checked;
    } else {
      value = ev.target.value;
    }
    this._config = { ...this._config, [option]: value };
    this.fireConfigChanged();
    this.requestUpdate();
  }

  fireConfigChanged() {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    const selectedRoom = this._config.room || "";
    return html`
      <div>
        <label for="room">Select Room:</label>
        <select id="room" @change="${this._roomChanged}">
          ${this.rooms.map(room => html`
            <option value="${room.entity_id}" ?selected="${room.entity_id === selectedRoom}">${room.friendly_name}</option>
          `)}
        </select>
      </div>
      <div>
        <label for="show_name">Show Name:</label>
        <input type="checkbox" id="show_name" name="show_name" .checked="${this._config.show_name !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="show_icon">Show Icon:</label>
        <input type="checkbox" id="show_icon" name="show_icon" .checked="${this._config.show_icon !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="show_untracked_values">Show Untracked Values:</label>
        <input type="checkbox" id="show_untracked_values" name="show_untracked_values" .checked="${this._config.show_untracked_values !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="combine_value_untracked">Combine Untracked Values:</label>
        <input type="checkbox" id="combine_value_untracked" name="combine_value_untracked" .checked="${this._config.combine_value_untracked !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="clean_subelement_names">Clean Subelement Names:</label>
        <input type="checkbox" id="clean_subelement_names" name="clean_subelement_names" .checked="${this._config.clean_subelement_names !== false}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="show_children">Show Children:</label>
        <input type="checkbox" id="show_children" name="show_children" .checked="${this._config.show_children !== false}" @change="${this._toggleOption}">
      </div>
      <!-- New style options -->
      <div>
        <label for="tracked_color">Tracked Color:</label>
        <input type="color" id="tracked_color" name="tracked_color" value="${this._config.tracked_color}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="untracked_color">Untracked Color:</label>
        <input type="color" id="untracked_color" name="untracked_color" value="${this._config.untracked_color}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="room_name_position">Room Name Position:</label>
        <select id="room_name_position" name="room_name_position" @change="${this._toggleOption}">
          <option value="inside" ?selected="${this._config.room_name_position === 'inside' || !this._config.room_name_position}">Inside</option>
          <option value="below" ?selected="${this._config.room_name_position === 'below'}">Below</option>
        </select>
      </div>
      <div>
        <label for="tracked_value_size">Tracked Value Size:</label>
        <input type="text" id="tracked_value_size" name="tracked_value_size" value="${this._config.tracked_value_size}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="untracked_value_size">Untracked Value Size:</label>
        <input type="text" id="untracked_value_size" name="untracked_value_size" value="${this._config.untracked_value_size}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="room_name_size">Room Name Size:</label>
        <input type="text" id="room_name_size" name="room_name_size" value="${this._config.room_name_size}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="icon_size">Icon Size:</label>
        <input type="text" id="icon_size" name="icon_size" value="${this._config.icon_size}" @change="${this._toggleOption}">
      </div>
      <div>
        <label for="circle_size">Circle Size:</label>
        <input type="text" id="circle_size" name="circle_size" value="${this._config.circle_size}" @change="${this._toggleOption}">
      </div>
    `;
  }
}

customElements.define("energy-power-monitor-card-editor", EnergyandPowerMonitorCardEditor);

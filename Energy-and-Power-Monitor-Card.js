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
  preview: true,
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

  // toggle to true for debugging
  debugEnabled = false;
  debugLog(msg) { if (this.debugEnabled) console.debug('[EPM]', msg); }

  setConfig(config) {
    this.debugLog('setConfig');
    this.config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      levels_to_show: config.levels_to_show || "all",
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "below",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
      circle_size_unit: config.circle_size_unit || "px",
      color_untracked_label: config.color_untracked_label === true,
      remove_strings: config.remove_strings !== undefined ? config.remove_strings : "",
      room: config.room,
      ring_width: config.ring_width !== undefined ? config.ring_width : '6px',
      decimal_precision: (config.decimal_precision !== undefined) ? parseInt(config.decimal_precision) : 1,
      ...config,
    };
    this.rooms = [];
    // try fetch rooms if hass already available
    if (this.hass) this._fetchRooms().catch(e => this.debugLog(e));
  }

  // attempt to fetch rooms when hass becomes available or when config changes
  updated(changed) {
    if (changed.has('hass')) {
      if (this.hass) this._fetchRooms().catch(e => this.debugLog(e));
    }
  }

  async _fetchRooms() {
    this.debugLog('Fetching entity registry for rooms');
    if (!this.hass) {
      this.debugLog('hass not available yet');
      return;
    }
    try {
      const entities = await this.hass.callWS({ type: 'config/entity_registry/list' });
      this.rooms = entities
        .filter(entity =>
          entity.entity_id.startsWith('sensor.energy_power_monitor_') &&
          !((this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id)
            .toLowerCase().includes('untracked'))
        )
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                     .replace(/ (Power|Energy)$/gi, '')
                                     .trim();
          if (!friendlyName) friendlyName = entity.entity_id;
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      this.debugLog(`Found rooms: ${this.rooms.length}`);
      this.requestUpdate();
    } catch (err) {
      this.debugLog('Error fetching rooms: ' + err);
    }
  }

  getUntrackedEntityValue(entityId) {
    try {
      let val = null;
      if (entityId.endsWith('_power')) {
        val = this.hass.states[entityId.replace(/_power$/, '_untracked_power')]?.state;
      } else if (entityId.endsWith('_energy')) {
        val = this.hass.states[entityId.replace(/_energy$/, '_untracked_energy')]?.state;
      }
      if (val === undefined || val === null) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    } catch (e) {
      return null;
    }
  }

  // Build a flat tree structure. Avoid cycles via visited set.
  _createTreeView(entityId, level = 0, baseName = null, visited = new Set()) {
    if (visited.has(entityId)) {
      this.debugLog(`Skipping already visited ${entityId}`);
      return [];
    }
    visited.add(entityId);

    const entityState = this.hass.states[entityId];
    if (!entityState) {
      this.debugLog(`Entity state missing for ${entityId}`);
      return [];
    }

    const selEntities = Array.isArray(entityState.attributes.selected_entities)
      ? entityState.attributes.selected_entities
      : (typeof entityState.attributes.selected_entities === 'string'
          ? [entityState.attributes.selected_entities]
          : []);

    let originalFriendlyName = entityState.attributes.friendly_name || entityId;
    let friendlyName = originalFriendlyName.replace(/ selected entities -/gi, '')
                                          .replace(/ (Power|Energy)$/gi, '')
                                          .trim();

    if (level === 0) {
      baseName = friendlyName;
    } else {
      if (baseName && friendlyName.toLowerCase().startsWith(baseName.toLowerCase() + " ") && friendlyName.length > baseName.length) {
        friendlyName = friendlyName.substring(baseName.length).trim();
      }
      if (this.config.remove_strings) {
        const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(Boolean);
        for (let sub of substrings) {
          if (friendlyName.toLowerCase().startsWith(sub.toLowerCase() + " ") && friendlyName.length > sub.length) {
            friendlyName = friendlyName.substring(sub.length).trim();
            break;
          }
        }
      }
    }

    const normalValue = (() => {
      const n = parseFloat(entityState.state);
      return isNaN(n) ? 0 : n;
    })();

    const entityUnit = entityState.attributes.unit_of_measurement || '';
    const untrackedValue = this.getUntrackedEntityValue(entityId);
    const combinedValue = normalValue + (untrackedValue || 0);
    const displayValue = this.config.combine_value_untracked ? combinedValue : normalValue;
    const total = normalValue + (untrackedValue || 0);
    const percentage = total > 0 ? Math.round((untrackedValue || 0) / total * 100) : 0;

    let tree = [{
      entity_id: entityId,
      friendly_name: friendlyName,
      value: displayValue,
      unit: entityUnit,
      level: level,
      percentage: percentage,
      untrackedValue: untrackedValue
    }];

    selEntities.forEach(childEntityId => {
      try {
        if (!childEntityId) return;
        // If child is another energy_power_monitor sensor: recurse
        if (childEntityId.startsWith('sensor.energy_power_monitor_')) {
          const childTree = this._createTreeView(childEntityId, level + 1, baseName, visited);
          tree = tree.concat(childTree);
        } else {
          const childState = this.hass.states[childEntityId];
          if (!childState) return;
          let childFriendlyName = (childState.attributes.friendly_name || childEntityId)
                                    .replace(/ selected entities -/gi, '')
                                    .replace(/ (Power|Energy)$/gi, '')
                                    .trim();
          if (baseName && childFriendlyName.toLowerCase().startsWith(baseName.toLowerCase() + " ") && childFriendlyName.length > baseName.length) {
            childFriendlyName = childFriendlyName.substring(baseName.length).trim();
          }
          if (this.config.remove_strings) {
            const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(Boolean);
            for (let sub of substrings) {
              if (childFriendlyName.toLowerCase().startsWith(sub.toLowerCase() + " ") && childFriendlyName.length > sub.length) {
                childFriendlyName = childFriendlyName.substring(sub.length).trim();
                break;
              }
            }
          }
          if (!childFriendlyName) childFriendlyName = childEntityId;
          const childValueRaw = parseFloat(childState.state);
          const childValue = isNaN(childValueRaw) ? 0 : childValueRaw;
          const childUntracked = this.getUntrackedEntityValue(childEntityId);
          const childDisplayValue = this.config.combine_value_untracked ? (childValue + (childUntracked || 0)) : childValue;
          const childTotal = childValue + (childUntracked || 0);
          const childPercentage = childTotal > 0 ? Math.round((childUntracked || 0) / childTotal * 100) : 0;
          tree.push({
            entity_id: childEntityId,
            friendly_name: childFriendlyName,
            value: childDisplayValue,
            unit: childState.attributes.unit_of_measurement || '',
            level: level + 1,
            percentage: childPercentage,
            untrackedValue: childUntracked
          });
          this.debugLog(`Added child ${childFriendlyName} (${childEntityId})`);
        }
      } catch (e) {
        this.debugLog('Error processing child ' + childEntityId + ': ' + e);
      }
    });

    return tree;
  }

  // filter list by levels_to_show
  _filterTree(tree) {
    const option = this.config.levels_to_show || "all";
    if (option === "selected") {
      return tree.filter(node => node.level === 0);
    } else if (option === "first") {
      return tree.filter(node => node.level <= 1);
    } else if (option === "parents") {
      // keep a node if it has at least one child (next level > current level)
      return tree.filter((node, idx) => {
        const curLevel = node.level;
        for (let j = idx + 1; j < tree.length; j++) {
          if (tree[j].level <= curLevel) break;
          if (tree[j].level === curLevel + 1) return true;
        }
        return false;
      });
    }
    return tree;
  }

  splitAtNearestSpace(text, maxLineLength = 15) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (let w of words) {
      if ((current + w).length > maxLineLength) {
        if (current) lines.push(current.trim());
        current = w + ' ';
      } else {
        current += w + ' ';
      }
    }
    if (current) lines.push(current.trim());
    return lines;
  }

  _getBorderColor(percentage, untrackedValue) {
    const trackedColor = this.config.tracked_color || "#3CB371";
    const untrackedColor = this.config.untracked_color || "#808080";
    if (untrackedValue === null || isNaN(untrackedValue) || !this.config.show_untracked_values) {
      return `conic-gradient(${trackedColor} 0% 100%)`;
    }
    if (percentage > 0 && this.config.show_untracked_values) {
      // show untracked portion first (0 → percentage), then tracked
      return `conic-gradient(${untrackedColor} 0% ${percentage}%, ${trackedColor} ${percentage}% 100%)`;
    }
    return `conic-gradient(${trackedColor} 0% 100%)`;
  }

  _handleEntityClick(entityId) {
    if (this.isClickHandling) return;
    this.isClickHandling = true;
    const ev = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(ev);
    setTimeout(() => this.isClickHandling = false, 150);
  }
  isClickHandling = false;

  _renderTreeView(treeStructure) {
    const filtered = this._filterTree(treeStructure);
    const renderItems = (items) => items.map(item => {
      const marginLeft = item.level * 60;
      const roomState = this.hass.states[item.entity_id];
      const showIcon = this.config.show_icon && roomState && roomState.attributes && roomState.attributes.icon;
      const normalDisplay = (item.value !== null && item.value !== undefined) ? `${item.value} ${item.unit || ''}`.trim() : '';
      const untrackedDisplay = this.config.show_untracked_values && item.untrackedValue !== null
        ? `U: ${item.untrackedValue} ${item.unit || ''}`.trim()
        : '';
      const friendlyNameDisplayInside = this.splitAtNearestSpace(item.friendly_name).map(line => html`<div class="friendly-name-line">${line}</div>`);
      const circleBackground = this._getBorderColor(item.percentage, item.untrackedValue);
      // style variable sets the gradient for ::before
      const circleStyle = `--circle-background: ${circleBackground};`;
      if (this.config.room_name_position === 'below' && this.config.show_name) {
        return html`
          <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0" aria-label="${item.friendly_name}">
            <div class="circle-wrapper">
              <div class="circle" data-entity-id="${item.entity_id}" style="${circleStyle}; width: var(--circle-size); height: var(--circle-size);">
                <div class="circle-content">
                  ${showIcon ? html`
                    <ha-icon 
                      style="--mdc-icon-size: ${this.config.icon_size}; position: relative; top: -5px;"
                      icon="${roomState.attributes.icon}">
                    </ha-icon>
                  ` : ''}
                  <div class="entity-value">${normalDisplay}</div>
                  ${untrackedDisplay ? html`<div class="untracked-value">${untrackedDisplay}</div>` : ''}
                </div>
              </div>
              <div class="room-name">${item.friendly_name}</div>
            </div>
          </div>
        `;
      } else {
        return html`
          <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft}px;" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0" aria-label="${item.friendly_name}">
            <div class="circle" data-entity-id="${item.entity_id}" style="${circleStyle}; width: var(--circle-size); height: var(--circle-size);">
              <div class="circle-content">
                ${showIcon ? html`
                  <ha-icon 
                    style="--mdc-icon-size: ${this.config.icon_size}; position: relative; top: -5px;"
                    icon="${roomState.attributes.icon}">
                  </ha-icon>
                ` : ''}
                ${this.config.room_name_position === 'inside' && this.config.show_name ? html`
                  <div class="room-name ${!showIcon ? 'no-icon' : ''}">${friendlyNameDisplayInside}</div>
                ` : ''}
                <div class="entity-value">${normalDisplay}</div>
                ${untrackedDisplay ? html`<div class="untracked-value">${untrackedDisplay}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      }
    });
    return renderItems(filtered);
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
      --untracked-label-color: ${this.config.color_untracked_label ? this.config.untracked_color : 'grey'};
      --ring-width: ${this.config.ring_width || '6px'};
    `;
  }

  render() {
    const selectedRoom = this.config.room;
    const roomState = selectedRoom ? this.hass && this.hass.states[selectedRoom] : null;
    if (!selectedRoom || !roomState) {
      return html`<ha-card><div style="padding:16px">No room selected or room entity not found.</div></ha-card>`;
    }
    // build full tree (visited guard inside)
    const fullTree = this._createTreeView(selectedRoom);
    return html`
      <ha-card style="${this._getStyleVariables()}">
        <div class="container">
          <div class="tree-view">
            ${this._renderTreeView(fullTree)}
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
      :host { display: block; }
      .container { padding: 16px; text-align: center; }
      .circle-wrapper { display: inline-block; text-align: center; }
      .circle {
        position: relative;
        border-radius: 50%;
        display: inline-block;
        cursor: pointer;
        transition: background-color 0.3s;
        width: var(--circle-size, 80px);
        height: var(--circle-size, 80px);
      }
      /* show gradient ring behind everything */
      .circle::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        /* this var contains the conic-gradient string we set inline */
        background: var(--circle-background, var(--circle-tracked-color, #3CB371));
        z-index: 0;
        will-change: background;
      }

      /* cover the center with the card background to create a donut */
      .circle::after {
        content: "";
        position: absolute;
        /* inset by ring width (so the ring thickness = --ring-width) */
        left: var(--ring-width, 6px);
        top: var(--ring-width, 6px);
        right: var(--ring-width, 6px);
        bottom: var(--ring-width, 6px);
        border-radius: 50%;
        /* many HA themes use different vars — include sensible fallbacks */
        background: var(--ha-card-background, var(--card-background-color, var(--paper-card-background-color, white)));
        z-index: 1;
        pointer-events: none; /* avoid intercepting clicks */
      }

      /* content must be above the ::after so text/icons remain visible */
      .circle-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100%;
        width: 100%;
        padding: 10px;
        box-sizing: border-box;
        pointer-events: none; /* content itself shouldn't block the parent click handler */
      }

      /* ensure icons/text still receive pointer events when required (e.g. tooltips) */
      .circle-content > * { pointer-events: auto; }
      .tree-item { position: relative; margin-bottom: 8px; }
      .tree-item[data-level]:not([data-level="0"])::before {
        content: "";
        position: absolute;
        left: -28px;
        top: 0;
        bottom: 0;
        border-left: 2px solid var(--divider-color, #e0e0e0);
      }
      .friendly-name-line { margin: 0; line-height: 1.2; }
      .room-name {
        margin: 0;
        font-size: var(--room-name-size, 10.5px);
        margin-top: 6px;
        white-space: nowrap;
      }
      .icon { font-size: var(--icon-size, 22px); margin-bottom: 3.5px; }
      .tree-view { margin-top: 10px; text-align: left; }
      .entity-value { text-align: center; font-size: var(--tracked-value-size, 10.5px); line-height: 1.1; color: white; }
      .untracked-value { text-align: center; font-size: var(--untracked-value-size, 10.5px); line-height: 1.1; margin-top: 2px; color: var(--untracked-label-color, grey); }
    `;
  }
}

customElements.define('energy-power-monitor-card', EnergyandPowerMonitorCard);

class EnergyandPowerMonitorCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      rooms: { type: Array }
    };
  }

  setConfig(config) {
    this._config = {
      show_name: config.show_name !== false,
      show_icon: config.show_icon !== false,
      show_untracked_values: config.show_untracked_values !== false,
      combine_value_untracked: config.combine_value_untracked !== false,
      levels_to_show: config.levels_to_show || "all",
      tracked_color: config.tracked_color || "#3CB371",
      untracked_color: config.untracked_color || "#808080",
      room_name_position: config.room_name_position || "below",
      tracked_value_size: config.tracked_value_size || "10.5px",
      untracked_value_size: config.untracked_value_size || "10.5px",
      room_name_size: config.room_name_size || "10.5px",
      icon_size: config.icon_size || "22px",
      circle_size: config.circle_size || "80px",
      color_untracked_label: config.color_untracked_label === true,
      remove_strings: config.remove_strings !== undefined ? config.remove_strings : "",
      room: config.room,
      ...config,
    };
    this.rooms = [];
    if (this.hass) this._fetchRooms().catch(e => console.debug(e));
  }

  async _fetchRooms() {
    if (!this.hass) return;
    try {
      const entities = await this.hass.callWS({ type: 'config/entity_registry/list' });
      this.rooms = entities
        .filter(entity =>
          entity.entity_id.startsWith('sensor.energy_power_monitor_') &&
          !((this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id).toLowerCase().includes('untracked'))
        )
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                     .replace(/ (Power|Energy)$/gi, '')
                                     .trim();
          if (!friendlyName) friendlyName = entity.entity_id;
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      if (!this._config.room && this.rooms.length > 0) {
        this._config.room = this.rooms[0].entity_id;
        this.fireConfigChanged();
      }
      this.requestUpdate();
    } catch (err) {
      console.debug('Editor _fetchRooms error', err);
    }
  }

  _roomChanged(ev) {
    const selectedRoom = ev.target.value;
    this._config = { ...this._config, room: selectedRoom };
    this.fireConfigChanged();
  }

  _toggleOption(ev) {
    const option = ev.target.name;
    let value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    // checkboxes return boolean, select/text return string
    this._config = { ...this._config, [option]: value };
    this.fireConfigChanged();
    this.requestUpdate();
  }

  fireConfigChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const fontSizeOptions = [];
    for (let i = 8; i <= 20; i += 0.5) fontSizeOptions.push(i.toFixed(1) + "px");
    const circleSizeOptions = [];
    for (let i = 50; i <= 200; i += 5) circleSizeOptions.push(i + "px");
    const iconSizeOptions = [];
    for (let i = 12; i <= 50; i += 1) iconSizeOptions.push(i + "px");
    const selectedRoom = this._config?.room || "";

    return html`
      <style>
        .option-group { margin-bottom: 16px; border: 1px solid var(--divider-color, #e0e0e0); padding: 8px; border-radius: 4px; }
        .option-group h3 { margin: 0 0 8px 0; font-size: 12.5px; }
        .option { display: flex; align-items: center; margin-bottom: 6px; }
        .option label { flex: 0 0 200px; font-size: 12.5px; }
        .option input[type="checkbox"] { margin-left: auto; width: 16px; height: 16px; }
        .option input[type="color"], .option input[type="text"], .option select { flex: 1; font-size: 12.5px; padding: 2px; margin-left: 0; }
      </style>

      <div class="option-group">
        <h3>General Options</h3>
        <div class="option">
          <label for="room">Select Room:</label>
          <select id="room" @change="${this._roomChanged}">
            ${this.rooms.map(room => html`
              <option value="${room.entity_id}" ?selected="${room.entity_id === selectedRoom}">
                ${room.friendly_name}
              </option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="show_name">Show Name:</label>
          <input type="checkbox" id="show_name" name="show_name" .checked="${this._config.show_name !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="show_icon">Show Icon:</label>
          <input type="checkbox" id="show_icon" name="show_icon" .checked="${this._config.show_icon !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="show_untracked_values">Show Untracked Values:</label>
          <input type="checkbox" id="show_untracked_values" name="show_untracked_values" .checked="${this._config.show_untracked_values !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="combine_value_untracked">Combine Untracked Values:</label>
          <input type="checkbox" id="combine_value_untracked" name="combine_value_untracked" .checked="${this._config.combine_value_untracked !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="levels_to_show">Levels to Display:</label>
          <select id="levels_to_show" name="levels_to_show" @change="${this._toggleOption}">
            <option value="all" ?selected="${this._config.levels_to_show === 'all'}">All</option>
            <option value="selected" ?selected="${this._config.levels_to_show === 'selected'}">Only Selected</option>
            <option value="parents" ?selected="${this._config.levels_to_show === 'parents'}">All Parents</option>
            <option value="first" ?selected="${this._config.levels_to_show === 'first'}">1st Level Max</option>
          </select>
        </div>
      </div>

      <div class="option-group">
        <h3>Style Options</h3>
        <div class="option">
          <label for="tracked_color">Tracked Color:</label>
          <input type="color" id="tracked_color" name="tracked_color" .value="${this._config.tracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="untracked_color">Untracked Color:</label>
          <input type="color" id="untracked_color" name="untracked_color" .value="${this._config.untracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="color_untracked_label">Color Untracked Label:</label>
          <input type="checkbox" id="color_untracked_label" name="color_untracked_label" .checked="${this._config.color_untracked_label === true}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="room_name_position">Room Name Position:</label>
          <select id="room_name_position" name="room_name_position" @change="${this._toggleOption}">
            <option value="inside" ?selected="${this._config.room_name_position === 'inside'}">Inside</option>
            <option value="below" ?selected="${this._config.room_name_position === 'below'}">Below</option>
          </select>
        </div>
        <div class="option">
          <label for="remove_strings" title="Enter prefix(s) to remove (separated by ';') from child names">Remove prefix (sep. by ';'):</label>
          <input type="text" id="remove_strings" name="remove_strings" .value="${this._config.remove_strings}" @change="${this._toggleOption}">
        </div>

        <div class="option">
          <label for="tracked_value_size">Tracked Value Size:</label>
          <select id="tracked_value_size" name="tracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.tracked_value_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="untracked_value_size">Untracked Value Size:</label>
          <select id="untracked_value_size" name="untracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.untracked_value_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="room_name_size">Room Name Size:</label>
          <select id="room_name_size" name="room_name_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.room_name_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="icon_size">Icon Size:</label>
          <select id="icon_size" name="icon_size" @change="${this._toggleOption}">
            ${iconSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.icon_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="circle_size">Circle Size:</label>
          <select id="circle_size" name="circle_size" @change="${this._toggleOption}">
            ${circleSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.circle_size === size}">${size}</option>`)}
          </select>
        </div>
      </div>
    `;
  }
}

customElements.define("energy-power-monitor-card-editor", EnergyandPowerMonitorCardEditor);

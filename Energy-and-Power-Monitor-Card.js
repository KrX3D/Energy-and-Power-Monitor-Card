/**
 * Energy Monitor Card - Unified Version
 * All logic and UI in one file, drop-in replacement for HACS installation
 * No YAML changes needed - works exactly like before
 */

import {
  LitElement,
  html,
  css
} from "https://unpkg.com/lit-element@2.3.1/lit-element.js?module";

const TRANSLATIONS = {
  en: {
    card_not_configured: "Card not configured yet.",
    no_zone_selected: "No zone selected or zone entity not found.",
    general_options: "General Options",
    style_options: "Style Options",
    select_zone: "Select Zone:",
    show_name: "Show Name:",
    show_icon: "Show Icon:",
    show_untracked_values: "Show Untracked Values:",
    combine_untracked_values: "Combine Untracked Values:",
    levels_to_display: "Levels to Display:",
    levels_all: "All",
    levels_selected: "Only Selected",
    levels_parents: "All Parents",
    levels_first: "1st Level Max",
    tracked_color: "Tracked Color:",
    untracked_color: "Untracked Color:",
    color_untracked_label: "Color Untracked Label:",
    zone_name_position: "Zone Name Position:",
    position_inside: "Inside",
    position_below: "Below",
    remove_prefix: "Remove prefix (sep. by ';'):",
    remove_prefix_title: "Enter prefix(s) to remove (separated by ';') from child names",
    tracked_value_size: "Tracked Value Size:",
    untracked_value_size: "Untracked Value Size:",
    zone_name_size: "Zone Name Size:",
    icon_size: "Icon Size:",
    circle_size: "Circle Size:",
    ring_width: "Ring Width:",
    decimal_precision: "Decimal Precision:",
    decimal_precision_title: "Decimal places shown for numeric values",
  },
  de: {
    card_not_configured: "Karte ist noch nicht konfiguriert.",
    no_zone_selected: "Keine Zone ausgewählt oder Zonen-Entität nicht gefunden.",
    general_options: "Allgemeine Optionen",
    style_options: "Stiloptionen",
    select_zone: "Zone auswählen:",
    show_name: "Namen anzeigen:",
    show_icon: "Symbol anzeigen:",
    show_untracked_values: "Nicht erfasste Werte anzeigen:",
    combine_untracked_values: "Nicht erfasste Werte kombinieren:",
    levels_to_display: "Ebenen anzeigen:",
    levels_all: "Alle",
    levels_selected: "Nur ausgewählte",
    levels_parents: "Alle Eltern",
    levels_first: "Max. 1. Ebene",
    tracked_color: "Erfasste Farbe:",
    untracked_color: "Nicht erfasste Farbe:",
    color_untracked_label: "Label-Farbe für nicht erfasste Werte:",
    zone_name_position: "Position des Zonennamens:",
    position_inside: "Innen",
    position_below: "Unten",
    remove_prefix: "Präfix entfernen (getrennt durch ';'):",
    remove_prefix_title: "Präfix(e) entfernen (getrennt durch ';') aus Kindnamen",
    tracked_value_size: "Größe erfasster Werte:",
    untracked_value_size: "Größe nicht erfasster Werte:",
    zone_name_size: "Größe Zonenname:",
    icon_size: "Symbolgröße:",
    circle_size: "Kreisgröße:",
    ring_width: "Ringbreite:",
    decimal_precision: "Dezimalstellen:",
    decimal_precision_title: "Anzahl der Dezimalstellen für numerische Werte",
  },
};

const localize = (hass, key) => {
  const language = hass?.locale?.language || hass?.language || "en";
  const short = language.split("-")[0];
  return TRANSLATIONS[language]?.[key]
    || TRANSLATIONS[short]?.[key]
    || TRANSLATIONS.en[key]
    || key;
};

// ============================================================================
// CORE LOGIC - EnergyMonitorLogic Class
// ============================================================================

class EnergyMonitorLogic {
  constructor(config = {}) {
    this.config = this._initConfig(config);
    this.debugEnabled = false;
  }

  _initConfig(config) {
    const zone = config.zone ?? config.room;
    return {
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
      zone,
      ring_width: config.ring_width !== undefined ? config.ring_width : '6px',
      decimal_precision: (config.decimal_precision !== undefined) ? parseInt(config.decimal_precision) : 1,
      ...config,
    };
  }

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EnergyMonitorCore]', msg);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  _isUntrackedEntityId(entityId) {
    if (!entityId) return false;
    return /_untracked(_power|_energy)?$/i.test(entityId) || entityId.toLowerCase().includes('_untracked');
  }

  getUntrackedEntityValue(entityId, states) {
    try {
      let val = null;
      if (entityId.endsWith('_power')) {
        val = states[entityId.replace(/_power$/, '_untracked_power')]?.state;
      } else if (entityId.endsWith('_energy')) {
        val = states[entityId.replace(/_energy$/, '_untracked_energy')]?.state;
      }
      if (val === undefined || val === null) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    } catch (e) {
      return null;
    }
  }

  createTreeView(entityId, states, level = 0, baseName = null, visited = new Set()) {
    if (this._isUntrackedEntityId(entityId)) {
      this.debugLog(`Skipping untracked entity ${entityId}`);
      return [];
    }

    if (visited.has(entityId)) {
      this.debugLog(`Skipping already visited ${entityId}`);
      return [];
    }
    visited.add(entityId);

    const entityState = states[entityId];
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
    let friendlyName = this._cleanFriendlyName(originalFriendlyName, baseName, level);

    if (level === 0) {
      baseName = friendlyName;
    }

    const normalValue = parseFloat(entityState.state) || 0;
    const entityUnit = entityState.attributes.unit_of_measurement || '';
    const untrackedValue = this.getUntrackedEntityValue(entityId, states);
    const displayValue = this.config.combine_value_untracked ? (normalValue + (untrackedValue || 0)) : normalValue;
    const total = normalValue + (untrackedValue || 0);
    const percentage = total > 0 ? Math.round((untrackedValue || 0) / total * 100) : 0;

    let tree = [{
      entity_id: entityId,
      friendly_name: friendlyName,
      value: displayValue,
      unit: entityUnit,
      level: level,
      percentage: percentage,
      untrackedValue: untrackedValue,
      icon: entityState.attributes.icon || null,
      state: entityState.state,
    }];

    selEntities.forEach(childEntityId => {
      try {
        if (!childEntityId) return;
        if (this._isUntrackedEntityId(childEntityId)) {
          this.debugLog(`Skipping child untracked entity ${childEntityId}`);
          return;
        }

        if (childEntityId.startsWith('sensor.energy_power_monitor_')) {
          const childTree = this.createTreeView(childEntityId, states, level + 1, baseName, visited);
          tree = tree.concat(childTree);
        } else {
          const childState = states[childEntityId];
          if (!childState) return;

          let childFriendlyName = (childState.attributes.friendly_name || childEntityId)
                                    .replace(/ selected entities -/gi, '')
                                    .replace(/ (Power|Energy)$/gi, '')
                                    .trim();

          if (baseName && childFriendlyName.toLowerCase().startsWith(baseName.toLowerCase() + " ")) {
            childFriendlyName = childFriendlyName.substring(baseName.length).trim();
          }

          if (this.config.remove_strings) {
            const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(Boolean);
            for (let sub of substrings) {
              if (childFriendlyName.toLowerCase().startsWith(sub.toLowerCase() + " ")) {
                childFriendlyName = childFriendlyName.substring(sub.length).trim();
                break;
              }
            }
          }

          if (!childFriendlyName) childFriendlyName = childEntityId;

          const childValue = parseFloat(childState.state) || 0;
          const childUntracked = this.getUntrackedEntityValue(childEntityId, states);
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
            untrackedValue: childUntracked,
            icon: childState.attributes.icon || null,
            state: childState.state,
          });

          this.debugLog(`Added child ${childFriendlyName} (${childEntityId})`);
        }
      } catch (e) {
        this.debugLog('Error processing child ' + childEntityId + ': ' + e);
      }
    });

    return tree;
  }

  _cleanFriendlyName(name, baseName, level) {
    let cleaned = name.replace(/ selected entities -/gi, '')
                      .replace(/ (Power|Energy)$/gi, '')
                      .trim();

    if (baseName && level > 0 && cleaned.toLowerCase().startsWith(baseName.toLowerCase() + " ")) {
      cleaned = cleaned.substring(baseName.length).trim();
    }

    if (this.config.remove_strings && level > 0) {
      const substrings = this.config.remove_strings.split(";").map(s => s.trim()).filter(Boolean);
      for (let sub of substrings) {
        if (cleaned.toLowerCase().startsWith(sub.toLowerCase() + " ")) {
          cleaned = cleaned.substring(sub.length).trim();
          break;
        }
      }
    }

    return cleaned;
  }

  filterTree(tree) {
    const option = this.config.levels_to_show || "all";
    if (option === "selected") {
      return tree.filter(node => node.level === 0);
    } else if (option === "first") {
      return tree.filter(node => node.level <= 1);
    } else if (option === "parents") {
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

  formatNumber(val) {
    if (val === null || val === undefined || isNaN(parseFloat(val))) return '';

    const rawPrecision = this.config.decimal_precision || 1;
    const precision = Math.max(0, Math.min(3, parseInt(rawPrecision, 10) || 1));

    try {
      const fixed = Number(val).toFixed(precision);
      const parsed = parseFloat(fixed);
      return isNaN(parsed) ? String(Number(val)) : parsed.toString();
    } catch (e) {
      const n = Number(val);
      return isNaN(n) ? '' : n.toString();
    }
  }

  formatValue(val, unit) {
    const numStr = this.formatNumber(val);
    if (!numStr) return '';
    return unit ? `${numStr} ${unit}` : numStr;
  }

  getBorderColor(percentage, untrackedValue) {
    const trackedColor = this.config.tracked_color || "#3CB371";
    const untrackedColor = this.config.untracked_color || "#808080";

    if (untrackedValue === null || isNaN(untrackedValue) || !this.config.show_untracked_values) {
      return `conic-gradient(${trackedColor} 0% 100%)`;
    }

    if (percentage > 0 && this.config.show_untracked_values) {
      return `conic-gradient(${untrackedColor} 0% ${percentage}%, ${trackedColor} ${percentage}% 100%)`;
    }

    return `conic-gradient(${trackedColor} 0% 100%)`;
  }

  getStyleVariables() {
    const trackedValSize = this.config.tracked_value_size || '10.5px';
    const untrackedValSize = this.config.untracked_value_size || '10.5px';
    const zoneNameSize = this.config.room_name_size || '10.5px';
    const iconSize = this.config.icon_size || '22px';
    const circleSize = this.config.circle_size || '80px';
    const trackedColor = this.config.tracked_color || '#3CB371';
    const untrackedColor = this.config.untracked_color || '#808080';
    const untrackedLabelColor = this.config.color_untracked_label ? untrackedColor : 'grey';

    const circleSizeNum = parseFloat(circleSize) || 80;
    const ringNum = parseFloat(this.config.ring_width) || 6;
    const maxRing = Math.max(2, Math.floor(circleSizeNum / 2) - 4);
    const finalRing = Math.min(ringNum, maxRing);
    const levelIndent = Math.min(60, Math.max(24, Math.round(circleSizeNum * 0.6)));

    return {
      trackedValSize,
      untrackedValSize,
      zoneNameSize,
      iconSize,
      circleSize,
      trackedColor,
      untrackedColor,
      untrackedLabelColor,
      ringWidth: finalRing,
      levelIndent,
    };
  }

  splitAtNearestSpace(text, maxLineLength = 15) {
    if (!text) return [];
    const words = String(text).split(' ').filter(Boolean);
    if (words.length === 0) return [];
    const lines = [];
    let current = '';

    for (let w of words) {
      if ((current + (current ? ' ' : '') + w).length > maxLineLength) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = current ? `${current} ${w}` : w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  getProcessedData(entityId, states) {
    const tree = this.createTreeView(entityId, states);
    const filtered = this.filterTree(tree);
    const styles = this.getStyleVariables();

    return {
      items: filtered,
      styles,
      config: this.config,
    };
  }
}

// ============================================================================
// CARD COMPONENT
// ============================================================================

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-power-monitor-card',
  name: 'Energy and Power Monitor',
  description: "Displays power states for selected zones.",
  preview: true,
});

class EnergyandPowerMonitorCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      treeStructure: { type: Array },
      zones: { type: Array },
    };
  }

  constructor() {
    super();
    this.debugEnabled = false;
    this.isClickHandling = false;
    this.logic = null;
    this.zones = [];
    this._entityRegistryUnsub = null;
    this._zonesInitialized = false;
  }

  debugLog(msg) {
    if (this.debugEnabled) console.debug('[EPM]', msg);
  }

  _t(key) {
    return localize(this.hass, key);
  }

  setConfig(config) {
    this.debugLog('setConfig');
    this.logic = new EnergyMonitorLogic(config);
    this.config = this.logic.config;
    this.zones = [];
    this._zonesInitialized = false;
    if (this.hass) this._fetchZones().catch(e => this.debugLog(e));
  }

  updated(changed) {
    if (changed.has('hass')) {
      if (this.hass && !this._zonesInitialized) {
        this._fetchZones().catch(e => this.debugLog(e));
      }
      this._subscribeEntityRegistry();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._entityRegistryUnsub) {
      this._entityRegistryUnsub();
      this._entityRegistryUnsub = null;
    }
  }

  _subscribeEntityRegistry() {
    if (!this.hass || this._entityRegistryUnsub) return;
    this.hass.connection.subscribeEvents(
      () => this._fetchZones().catch(e => this.debugLog(e)),
      'entity_registry_updated'
    ).then(unsub => {
      this._entityRegistryUnsub = unsub;
    }).catch(err => this.debugLog('Failed to subscribe entity_registry_updated: ' + err));
  }

  async _fetchZones() {
    this.debugLog('Fetching entity registry for zones');
    if (!this.hass || !this.logic) {
      this.debugLog('hass or logic not available yet');
      return;
    }
    try {
      const entities = await this.hass.callWS({ type: 'config/entity_registry/list' });
      this.zones = entities
        .filter(entity => {
          const entityId = entity.entity_id || '';
          const friendly = (this.hass.states[entityId]?.attributes.friendly_name || entityId).toLowerCase();
          if (!entityId.startsWith('sensor.energy_power_monitor_')) return false;
          if (this.logic._isUntrackedEntityId(entityId)) return false;
          if (friendly.includes('untracked')) return false;
          return true;
        })
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '')
                                     .replace(/ (Power|Energy)$/gi, '')
                                     .trim();
          if (!friendlyName) friendlyName = entity.entity_id;
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      this.debugLog(`Found zones: ${this.zones.length}`);
      this._zonesInitialized = true;
      this.requestUpdate();
    } catch (err) {
      this.debugLog('Error fetching zones: ' + err);
    }
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

  _renderTreeView(treeStructure) {
    const filtered = this.logic.filterTree(treeStructure);
    const renderItems = (items) => items.map(item => {
      const marginLeft = `calc(${item.level} * var(--level-indent, 48px))`;
      const zoneState = this.hass && this.hass.states ? this.hass.states[item.entity_id] : null;
      const showIcon = (this.config.show_icon) && zoneState && zoneState.attributes && zoneState.attributes.icon;
      const normalDisplay = (item.value !== null && item.value !== undefined) ? this.logic.formatValue(item.value, item.unit) : '';
      const untrackedDisplay = (this.config.show_untracked_values && item.untrackedValue !== null && item.untrackedValue !== undefined)
        ? `U: ${this.logic.formatValue(item.untrackedValue, item.unit)}`
        : '';
      const friendlyNameDisplayInside = this.logic.splitAtNearestSpace(item.friendly_name).map(line => html`<div class="friendly-name-line">${line}</div>`);
      const circleBackground = this.logic.getBorderColor(item.percentage, item.untrackedValue);

      const circleStyle = `--circle-background: ${circleBackground};`;
      if (this.config.room_name_position === 'below' && this.config.show_name) {
        return html`
          <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft};" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0" aria-label="${item.friendly_name}">
            <div class="circle-wrapper">
              <div class="circle" data-entity-id="${item.entity_id}" style="${circleStyle}; width: var(--circle-size); height: var(--circle-size);">
                <div class="circle-content">
                  ${showIcon ? html`
                    <ha-icon 
                      style="--mdc-icon-size: ${this.config.icon_size}; position: relative; top: -5px;"
                      icon="${zoneState.attributes.icon}">
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
          <div class="tree-item" data-level="${item.level}" style="margin-left: ${marginLeft};" @click="${() => this._handleEntityClick(item.entity_id)}" role="button" tabindex="0" aria-label="${item.friendly_name}">
            <div class="circle" data-entity-id="${item.entity_id}" style="${circleStyle}; width: var(--circle-size); height: var(--circle-size);">
              <div class="circle-content">
                ${showIcon ? html`
                  <ha-icon 
                    style="--mdc-icon-size: ${this.config.icon_size}; position: relative; top: -5px;"
                    icon="${zoneState.attributes.icon}">
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
    const vars = this.logic.getStyleVariables();
    return `
      --tracked-value-size: ${vars.trackedValSize};
      --untracked-value-size: ${vars.untrackedValSize};
      --room-name-size: ${vars.zoneNameSize};
      --icon-size: ${vars.iconSize};
      --circle-size: ${vars.circleSize};
      --circle-tracked-color: ${vars.trackedColor};
      --circle-untracked-color: ${vars.untrackedColor};
      --untracked-label-color: ${vars.untrackedLabelColor};
      --ring-width: ${vars.ringWidth}px;
      --level-indent: ${vars.levelIndent}px;
    `;
  }

  render() {
    if (!this.config || !this.logic) {
      return html`<ha-card><div style="padding:16px">${this._t('card_not_configured')}</div></ha-card>`;
    }

    const selectedZone = this.config.zone ?? this.config.room;
    const zoneState = selectedZone ? (this.hass && this.hass.states ? this.hass.states[selectedZone] : null) : null;
    if (!selectedZone || !zoneState) {
      return html`<ha-card><div style="padding:16px">${this._t('no_zone_selected')}</div></ha-card>`;
    }

    const fullTree = this.logic.createTreeView(selectedZone, this.hass.states);
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

      .circle::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--circle-background, var(--circle-tracked-color, #3CB371));
        z-index: 0;
        will-change: background;
      }

      .circle::after {
        content: "";
        position: absolute;
        left: var(--ring-width, 6px);
        top: var(--ring-width, 6px);
        right: var(--ring-width, 6px);
        bottom: var(--ring-width, 6px);
        border-radius: 50%;
        background: var(--ha-card-background, var(--card-background-color, var(--paper-card-background-color, white)));
        z-index: 1;
        pointer-events: none;
      }

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
        pointer-events: none;
      }

      .circle-content > * { pointer-events: auto; }
      .tree-item { position: relative; margin-bottom: 8px; }
      .tree-item[data-level]:not([data-level="0"])::before {
        content: "";
        position: absolute;
        left: calc(-0.5 * var(--level-indent, 48px));
        top: 0;
        bottom: 0;
        border-left: 2px solid var(--divider-color, #e0e0e0);
      }
      .friendly-name-line { margin: 0; line-height: 1.2; }
      .room-name {
        margin: 0;
        font-size: var(--room-name-size, 10.5px);
        margin-top: 6px;
        white-space: normal;
        word-break: break-word;
      }
      .tree-view { margin-top: 10px; text-align: left; }
      .entity-value { text-align: center; font-size: var(--tracked-value-size, 10.5px); line-height: 1.1; color: white; }
      .untracked-value { text-align: center; font-size: var(--untracked-value-size, 10.5px); line-height: 1.1; margin-top: 2px; color: var(--untracked-label-color, grey); }
    `;
  }
}

customElements.define('energy-power-monitor-card', EnergyandPowerMonitorCard);

// ============================================================================
// CARD EDITOR
// ============================================================================

class EnergyandPowerMonitorCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      zones: { type: Array }
    };
  }

  constructor() {
    super();
    this._config = {};
    this.zones = [];
    this._logic = null;
    this._entityRegistryUnsub = null;
    this._zonesInitialized = false;
  }

  _t(key) {
    return localize(this.hass, key);
  }

  setConfig(config) {
    this._logic = new EnergyMonitorLogic(config);
    this._config = this._logic.config;
    this.zones = [];
    this._zonesInitialized = false;
    if (this.hass) this._fetchZones().catch(e => console.debug(e));
  }

  updated(changed) {
    if (changed.has('hass')) {
      if (this.hass && !this._zonesInitialized) {
        this._fetchZones().catch(e => console.debug(e));
      }
      this._subscribeEntityRegistry();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._entityRegistryUnsub) {
      this._entityRegistryUnsub();
      this._entityRegistryUnsub = null;
    }
  }

  _subscribeEntityRegistry() {
    if (!this.hass || this._entityRegistryUnsub) return;
    this.hass.connection.subscribeEvents(
      () => this._fetchZones().catch(e => console.debug(e)),
      'entity_registry_updated'
    ).then(unsub => {
      this._entityRegistryUnsub = unsub;
    }).catch(err => console.debug('Editor subscribe failed', err));
  }

  async _fetchZones() {
    if (!this.hass || !this._logic) return;
    try {
      const entities = await this.hass.callWS({ type: 'config/entity_registry/list' });
      this.zones = entities
        .filter(entity => {
          const entityId = entity.entity_id || '';
          if (!entityId.startsWith('sensor.energy_power_monitor_')) return false;
          if (this._logic._isUntrackedEntityId(entityId)) return false;
          return true;
        })
        .map(entity => {
          let friendlyName = this.hass.states[entity.entity_id]?.attributes.friendly_name || entity.entity_id;
          friendlyName = friendlyName.replace(/ selected entities -/gi, '').replace(/ (Power|Energy)$/gi, '').trim();
          if (!friendlyName) friendlyName = entity.entity_id;
          return { entity_id: entity.entity_id, friendly_name: friendlyName };
        })
        .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
      if (!this._config.zone && !this._config.room && this.zones.length > 0) {
        this._config = { ...this._config, zone: this.zones[0].entity_id };
        this.fireConfigChanged();
      }
      this._zonesInitialized = true;
      this.requestUpdate();
    } catch (err) {
      console.debug('Editor _fetchZones error', err);
    }
  }

  _zoneChanged(ev) {
    const selectedZone = ev.target.value;
    this._config = { ...this._config, zone: selectedZone };
    this.fireConfigChanged();
  }

  _toggleOption(ev) {
    const option = ev.target.name;
    let value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (option === 'decimal_precision') {
      value = parseInt(value);
      if (isNaN(value)) value = 1;
      value = Math.max(0, Math.min(3, value));
    }
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
    const ringWidthOptions = ['2px','4px','6px','8px','10px','12px','16px'];
    const decimalOptions = [0,1,2,3];
    const selectedZone = this._config?.zone ?? this._config?.room ?? "";

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
        <h3>${this._t('general_options')}</h3>
        <div class="option">
          <label for="zone">${this._t('select_zone')}</label>
          <select id="zone" @change="${this._zoneChanged}">
            ${this.zones.map(zone => html`
              <option value="${zone.entity_id}" ?selected="${zone.entity_id === selectedZone}">
                ${zone.friendly_name}
              </option>
            `)}
          </select>
        </div>
        <div class="option">
          <label for="show_name">${this._t('show_name')}</label>
          <input type="checkbox" id="show_name" name="show_name" .checked="${this._config.show_name !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="show_icon">${this._t('show_icon')}</label>
          <input type="checkbox" id="show_icon" name="show_icon" .checked="${this._config.show_icon !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="show_untracked_values">${this._t('show_untracked_values')}</label>
          <input type="checkbox" id="show_untracked_values" name="show_untracked_values" .checked="${this._config.show_untracked_values !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="combine_value_untracked">${this._t('combine_untracked_values')}</label>
          <input type="checkbox" id="combine_value_untracked" name="combine_value_untracked" .checked="${this._config.combine_value_untracked !== false}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="levels_to_show">${this._t('levels_to_display')}</label>
          <select id="levels_to_show" name="levels_to_show" @change="${this._toggleOption}">
            <option value="all" ?selected="${this._config.levels_to_show === 'all'}">${this._t('levels_all')}</option>
            <option value="selected" ?selected="${this._config.levels_to_show === 'selected'}">${this._t('levels_selected')}</option>
            <option value="parents" ?selected="${this._config.levels_to_show === 'parents'}">${this._t('levels_parents')}</option>
            <option value="first" ?selected="${this._config.levels_to_show === 'first'}">${this._t('levels_first')}</option>
          </select>
        </div>
      </div>

      <div class="option-group">
        <h3>${this._t('style_options')}</h3>
        <div class="option">
          <label for="tracked_color">${this._t('tracked_color')}</label>
          <input type="color" id="tracked_color" name="tracked_color" .value="${this._config.tracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="untracked_color">${this._t('untracked_color')}</label>
          <input type="color" id="untracked_color" name="untracked_color" .value="${this._config.untracked_color}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="color_untracked_label">${this._t('color_untracked_label')}</label>
          <input type="checkbox" id="color_untracked_label" name="color_untracked_label" .checked="${this._config.color_untracked_label === true}" @change="${this._toggleOption}">
        </div>
        <div class="option">
          <label for="room_name_position">${this._t('zone_name_position')}</label>
          <select id="room_name_position" name="room_name_position" @change="${this._toggleOption}">
            <option value="inside" ?selected="${this._config.room_name_position === 'inside'}">${this._t('position_inside')}</option>
            <option value="below" ?selected="${this._config.room_name_position === 'below'}">${this._t('position_below')}</option>
          </select>
        </div>
        <div class="option">
          <label for="remove_strings" title="${this._t('remove_prefix_title')}">${this._t('remove_prefix')}</label>
          <input type="text" id="remove_strings" name="remove_strings" .value="${this._config.remove_strings}" @change="${this._toggleOption}">
        </div>

        <div class="option">
          <label for="tracked_value_size">${this._t('tracked_value_size')}</label>
          <select id="tracked_value_size" name="tracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.tracked_value_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="untracked_value_size">${this._t('untracked_value_size')}</label>
          <select id="untracked_value_size" name="untracked_value_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.untracked_value_size === size}">${size}</option>`)}
          </select>
        </div>
        <div class="option">
          <label for="room_name_size">${this._t('zone_name_size')}</label>
          <select id="room_name_size" name="room_name_size" @change="${this._toggleOption}">
            ${fontSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.room_name_size === size}">${size}</option>`)}
          </select>
        </div>

        <div class="option">
          <label for="icon_size">${this._t('icon_size')}</label>
          <select id="icon_size" name="icon_size" @change="${this._toggleOption}">
            ${iconSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.icon_size === size}">${size}</option>`)}
          </select>
        </div>

        <div class="option">
          <label for="circle_size">${this._t('circle_size')}</label>
          <select id="circle_size" name="circle_size" @change="${this._toggleOption}">
            ${circleSizeOptions.map(size => html`<option value="${size}" ?selected="${this._config.circle_size === size}">${size}</option>`)}
          </select>
        </div>

        <div class="option">
          <label for="ring_width">${this._t('ring_width')}</label>
          <select id="ring_width" name="ring_width" @change="${this._toggleOption}">
            ${ringWidthOptions.map(v => html`
              <option value="${v}" ?selected="${this._config.ring_width === v}">${v}</option>
            `)}
          </select>
        </div>

        <div class="option">
          <label for="decimal_precision" title="${this._t('decimal_precision_title')}">${this._t('decimal_precision')}</label>
          <select id="decimal_precision" name="decimal_precision" @change="${this._toggleOption}">
            ${decimalOptions.map(d => html`<option value="${d}" ?selected="${this._config.decimal_precision === d}">${d}</option>`)}
          </select>
        </div>

      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; }
    `;
  }
}

customElements.define("energy-power-monitor-card-editor", EnergyandPowerMonitorCardEditor);

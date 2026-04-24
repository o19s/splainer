/**
 * JsonTree — expandable/collapsible JSON tree view (replaces Angular ng-json-explorer).
 *
 * Accepts a parsed value, a JSON string (parsed with JSON.parse), or invalid JSON
 * strings (shown in a literal `<pre>`). All values render through Preact text nodes.
 *
 * Props:
 *   - `value` — unknown (object, array, primitive, or string to parse)
 *   - `maxHeight` — optional CSS length for scroll container (e.g. `'400px'`)
 *   - `className` — optional extra class on the outer wrapper
 *
 * Angular Splainer only ever passed `json-data` to `ng-json-explorer` (no `sort-by`, `url`,
 * `collapsed`, or `data` attributes in templates).
 */
import { useState, useCallback } from 'preact/hooks';

/** Two spaces per nesting level (matches typical JSON pretty-print indent). */
const INDENT_UNIT = '  ';

/** Stable key for collapse state (path = segments: string keys or array indices). */
export function pathKey(path) {
  return JSON.stringify(path);
}

export function normalizeJsonTreeInput(value) {
  if (value === undefined) return { mode: 'empty' };
  if (typeof value === 'string') {
    try {
      return { mode: 'json', data: JSON.parse(value) };
    } catch {
      return { mode: 'raw', text: value };
    }
  }
  return { mode: 'json', data: value };
}

function formatPrimitive(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function ToggleButton({ path, collapsed, onToggle }) {
  return (
    <button
      type="button"
      class="json-tree-toggle"
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expand' : 'Collapse'}
      onClick={() => onToggle(path)}
    >
      {collapsed ? '+' : '-'}
    </button>
  );
}

function JsonNode({ value, path, depth, isCollapsed, toggle }) {
  if (value === null) {
    return <span class="json-tree-null">null</span>;
  }
  const t = typeof value;
  if (t === 'string') {
    return <span class="json-tree-string">{JSON.stringify(value)}</span>;
  }
  if (t === 'number' || t === 'boolean') {
    return <span>{String(value)}</span>;
  }
  if (t !== 'object') {
    return <span>{formatPrimitive(value)}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <JsonArrayBranch
        value={value}
        path={path}
        depth={depth}
        isCollapsed={isCollapsed}
        toggle={toggle}
      />
    );
  }

  return (
    <JsonObjectBranch
      value={value}
      path={path}
      depth={depth}
      isCollapsed={isCollapsed}
      toggle={toggle}
    />
  );
}

function JsonArrayBranch({ value, path, depth, isCollapsed, toggle }) {
  const len = value.length;

  /* No toggle for [] — nothing to expand (matches empty-object {} below). */
  if (len === 0) {
    return (
      <span class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <span class="json-tree-bracket">{'[]'}</span>
      </span>
    );
  }

  const collapsed = isCollapsed(path);
  if (collapsed) {
    return (
      <span class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <ToggleButton path={path} collapsed={collapsed} onToggle={toggle} />
        <span>{' '}</span>
        <span class="json-tree-bracket">{`[${len} items]`}</span>
      </span>
    );
  }

  return (
    <div class="json-tree-block">
      <div class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <ToggleButton path={path} collapsed={collapsed} onToggle={toggle} />
        <span>{' '}</span>
        <span class="json-tree-bracket">{'['}</span>
      </div>
      {value.map((item, i) => (
        <div key={pathKey(path.concat(i))} class="json-tree-line">
          {INDENT_UNIT.repeat(depth + 1)}
          <JsonNode
            value={item}
            path={path.concat(i)}
            depth={depth + 1}
            isCollapsed={isCollapsed}
            toggle={toggle}
          />
          {i < len - 1 ? <span class="json-tree-comma">,</span> : null}
        </div>
      ))}
      <div class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <span class="json-tree-bracket">{']'}</span>
      </div>
    </div>
  );
}

function JsonObjectBranch({ value, path, depth, isCollapsed, toggle }) {
  const keys = Object.keys(value);
  const n = keys.length;

  if (n === 0) {
    return (
      <span class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <span class="json-tree-bracket">{'{}'}</span>
      </span>
    );
  }

  const collapsed = isCollapsed(path);
  if (collapsed) {
    return (
      <span class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <ToggleButton path={path} collapsed={collapsed} onToggle={toggle} />
        <span>{' '}</span>
        <span class="json-tree-bracket">{`{${n} keys}`}</span>
      </span>
    );
  }

  return (
    <div class="json-tree-block">
      <div class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <ToggleButton path={path} collapsed={collapsed} onToggle={toggle} />
        <span>{' '}</span>
        <span class="json-tree-bracket">{'{'}</span>
      </div>
      {keys.map((k, i) => (
        <div key={pathKey(path.concat(k))} class="json-tree-line">
          {INDENT_UNIT.repeat(depth + 1)}
          <span class="json-tree-key">{JSON.stringify(k)}</span>
          <span>: </span>
          <JsonNode
            value={value[k]}
            path={path.concat(k)}
            depth={depth + 1}
            isCollapsed={isCollapsed}
            toggle={toggle}
          />
          {i < n - 1 ? <span class="json-tree-comma">,</span> : null}
        </div>
      ))}
      <div class="json-tree-line">
        {INDENT_UNIT.repeat(depth)}
        <span class="json-tree-bracket">{'}'}</span>
      </div>
    </div>
  );
}

export function JsonTree({ value, maxHeight, className = '' }) {
  const [collapsedPaths, setCollapsedPaths] = useState(() => new Set());

  const toggle = useCallback((path) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      const k = pathKey(path);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (path) => collapsedPaths.has(pathKey(path)),
    [collapsedPaths],
  );

  const normalized = normalizeJsonTreeInput(value);
  if (normalized.mode === 'empty') {
    return null;
  }
  if (normalized.mode === 'raw') {
    return (
      <pre
        class={`json-tree json-tree-fallback ${className}`}
        style={{ maxHeight, overflow: maxHeight ? 'auto' : undefined }}
        data-role="json-tree"
      >
        {normalized.text}
      </pre>
    );
  }

  const data = normalized.data;
  const wrapStyle = {
    maxHeight,
    overflow: maxHeight ? 'auto' : undefined,
  };

  if (data !== null && typeof data === 'object') {
    return (
      <div
        class={`json-tree ${className}`}
        style={wrapStyle}
        data-role="json-tree"
      >
        <JsonNode
          value={data}
          path={[]}
          depth={0}
          isCollapsed={isCollapsed}
          toggle={toggle}
        />
      </div>
    );
  }

  return (
    <div
      class={`json-tree json-tree-primitive-root ${className}`}
      style={wrapStyle}
      data-role="json-tree"
    >
      <span>{formatPrimitive(data)}</span>
    </div>
  );
}

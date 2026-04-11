/**
 * stackedChart island — rendered as a JSX child of DocRow.
 * data-role="stacked-chart-detailed" is used by Playwright e2e tests.
 */
import { useState } from 'preact/hooks';

 
function MatchRow({ match }) {
  // Min/max clamp handles maxScore=0 (which makes percentage = Infinity).
  const pct = Math.max(0, Math.min(100, match.percentage));
  return (
    <div class="graph-explain">
      <div class="graph-label">{match.description}</div>
      <div
        class="progress"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="progress-bar" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

export function StackedChart({ doc, maxScore, onDetailed }) {
  const [showAll, setShowAll] = useState(false);

  // The defensive bail-out exists for docRow.spec.js's chart-agnostic
  // tests, which use a makeDoc that omits hotMatchesOutOf to stay
  // decoupled from the chart's render shape. Production docs always
  // have it.
  if (!doc || typeof doc.hotMatchesOutOf !== 'function') {
    return null;
  }
  const hots = doc.hotMatchesOutOf(maxScore) || [];

  function handleDetailed(e) {
    e.preventDefault();
    if (onDetailed) onDetailed();
  }

  if (hots.length <= 3) {
    return (
      <div>
        {hots.map((match, i) => (
          <MatchRow key={i} match={match} />
        ))}
        {onDetailed && (
          <a
            data-role="stacked-chart-detailed"
            style={{ fontSize: '10px' }}
            href=""
            onClick={handleDetailed}
          >
            Detailed
          </a>
        )}
      </div>
    );
  }

  // > 3 hots: show first 3, then a collapse for the rest, then a
  // Detailed link and a Show More/Less toggle.
  const firstThree = hots.slice(0, 3);
  const rest = hots.slice(3);
  return (
    <div>
      {firstThree.map((match, i) => (
        <MatchRow key={i} match={match} />
      ))}
      {showAll && (
        <div>
          {rest.map((match, i) => (
            <MatchRow key={'r' + i} match={match} />
          ))}
        </div>
      )}
      {/* Detailed is unconditional in the >3 branch; handleDetailed
          no-ops if onDetailed is undefined. */}
      <a
        data-role="stacked-chart-detailed"
        style={{ fontSize: '10px' }}
        href=""
        onClick={handleDetailed}
      >
        Detailed
      </a>
      &nbsp;&nbsp;&nbsp;
      <a
        href=""
        style={{ fontSize: '10px' }}
        onClick={(e) => {
          e.preventDefault();
          setShowAll((v) => !v);
        }}
      >
        Show {showAll ? 'Less' : 'More'}
      </a>
    </div>
  );
}

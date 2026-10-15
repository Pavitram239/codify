import PropTypes from "prop-types";

export function PageHeading({ context, title, description }) {
  return (
    <header className="workspace-heading">
      <p className="workspace-context">{context}</p>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}

export function Card({ title, children, className = "", ...props }) {
  return (
    <section className={`workspace-card ${className}`} {...props}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function Metric({ value, label, description }) {
  return (
    <div className="workspace-metric">
      <strong>{value}</strong>
      <span>{label}</span>
      {description && <small>{description}</small>}
    </div>
  );
}

export function Status({ children, tone = "blue" }) {
  return (
    <span className={`workspace-status workspace-status--${tone}`}>
      {children}
    </span>
  );
}

export function Record({ title, description, children, value }) {
  return (
    <div className="workspace-record">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {children}
      </div>
      {value !== undefined && <strong>{value}</strong>}
    </div>
  );
}

export function Field({ label, id, children }) {
  return (
    <div className="workspace-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function RequestState({ loading, error, onRetry }) {
  if (loading)
    return (
      <p className="workspace-message" role="status">
        Loading…
      </p>
    );
  if (error)
    return (
      <div className="workspace-message workspace-error" role="alert">
        {error}
        {onRetry && (
          <button className="workspace-link" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  return null;
}

PageHeading.propTypes = {
  context: PropTypes.node,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
};
Card.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};
Metric.propTypes = {
  value: PropTypes.node,
  label: PropTypes.string,
  description: PropTypes.node,
};
Status.propTypes = {
  children: PropTypes.node,
  tone: PropTypes.oneOf(["blue", "green", "amber"]),
};
Record.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  children: PropTypes.node,
  value: PropTypes.node,
};
Field.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  children: PropTypes.node,
};
RequestState.propTypes = {
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
};

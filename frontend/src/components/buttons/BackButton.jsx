<<<<<<< HEAD
import { Link, useNavigate } from 'react-router-dom';

/** Contextual glass back pill. Navigates history when no `to` is given. */
export function BackButton({ to, children = 'Back' }) {
  const navigate = useNavigate();
  const arrow = (
    <span className="arr" aria-hidden="true">
      ←
    </span>
  );

  if (to) {
    return (
      <Link className="btn-back" to={to}>
        {arrow}
        {children}
      </Link>
    );
  }

  return (
    <button className="btn-back" type="button" onClick={() => navigate(-1)}>
      {arrow}
      {children}
    </button>
=======
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";

export function BackButton({ to, label = "Back", className = "" }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button variant="tertiary" size="sm" onClick={handleClick} className={className}>
      ← {label}
    </Button>
>>>>>>> 936546e (Implement matchday reviews, analytics, and schema infrastructure)
  );
}

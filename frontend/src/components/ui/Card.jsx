export function Card({ children, className = "", center = false, ...props }) {
  const classes = ["card", className, center ? "center" : ""].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

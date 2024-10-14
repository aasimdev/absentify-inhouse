import { ReactNode } from "react";

const Button: React.FC<{
  children: ReactNode; className: string; disabled: boolean; onClick?: Function 
}> = (props) => {
  return (
    <button
      disabled={props.disabled}
      type="button"
      className={props.className}
      onClick={(e) => {
        e.preventDefault();
        if (props.onClick) props.onClick();
      }}
    >
      <p className="mx-auto my-auto">{props.children}</p>
    </button>
  );
};
export default Button;
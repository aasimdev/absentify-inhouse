import React, { useEffect, useRef } from 'react';

/**
 * Hook that alerts clicks outside of the passed ref
 */
function useOutsideAlerter(ref: any, onClick: Function) {
  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: any) {
      if (ref.current && !ref.current.contains(event.target)) {
        onClick();
      }
    }

    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClickOutside);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

/**
 * Component that alerts if you click outside of it
 */
const OutsideAlerter = (props: { children: any; onClick: Function }) => {
  const wrapperRef = useRef(null);
  useOutsideAlerter(wrapperRef, () => {
    props.onClick();
  });

  return <div ref={wrapperRef}>{props.children}</div>;
};
export default OutsideAlerter;

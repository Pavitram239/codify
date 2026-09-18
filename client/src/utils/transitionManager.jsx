/**
 * Utility to manage smooth transitions between pages/components
 */

import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { startNavigation, endNavigation } from '../redux/slices/historySlice';

// Check if these actions exist in userSlice, if not they'll be handled by the middleware as no-ops
const startPageTransition = () => ({ type: 'user/startPageTransition' });
const endPageTransition = () => ({ type: 'user/endPageTransition' });

export const usePageTransition = (initialState = false, transitionTime = 300) => {
  const [isVisible, setIsVisible] = useState(initialState);
  const dispatch = useDispatch();
  
  useEffect(() => {
    // Start transition in
    dispatch(startNavigation());
    dispatch(startPageTransition());
    
    const timer = setTimeout(() => {
      setIsVisible(true);
      
      // End transition after component is fully visible
      dispatch(endNavigation());
      dispatch(endPageTransition());
    }, transitionTime);
    
    return () => {
      clearTimeout(timer);
      setIsVisible(false);
    };
  }, [dispatch, transitionTime]);
  
  return isVisible;
};

/**
 * Higher-order component for applying smooth transitions
 * @param {Component} Component - The component to wrap with transitions
 * @param {Number} duration - The transition duration in ms
 */
export const withTransition = (Component, duration = 300) => {
  return (props) => {
    const isVisible = usePageTransition(false, duration);
    
    return (
      <div className={`page-transition ${isVisible ? 'page-entered' : 'page-entering'}`}>
        <Component {...props} />
      </div>
    );
  };
};

/**
 * Handle navigation with transition
 * @param {Function} navigate - React Router's navigate function
 * @param {String} path - Path to navigate to
 * @param {Number} delay - Transition delay before navigation
 */
export const navigateWithTransition = (navigate, path, delay = 200) => {
  return (dispatch) => {
    dispatch(startNavigation());
    dispatch(startPageTransition());
    
    setTimeout(() => {
      navigate(path);
    }, delay);
  };
};

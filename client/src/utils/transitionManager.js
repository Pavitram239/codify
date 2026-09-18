/**
 * Utility to manage smooth transitions between pages/components
 */

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { startNavigation, endNavigation } from '../redux/slices/historySlice';
import React from 'react';

// Use existing actions if they exist
const startPageTransition = () => ({ type: 'user/startPageTransition' });
const endPageTransition = () => ({ type: 'user/endPageTransition' });

// Add a cache mechanism to prevent unnecessary data loading
const pageCache = new Map();

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
 * Check if we already have data for a specific key in Redux
 * @param {Object} state - Redux state
 * @param {String} key - Path to check in state
 * @returns {Boolean} - Whether data exists
 */
export const hasDataInRedux = (state, key) => {
  if (!key || typeof key !== 'string') return false;
  
  // Split the key path (e.g. "submissions.data")
  const parts = key.split('.');
  let current = state;
  
  // Navigate through the object
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  
  // Check if we have actual data (not empty array/object)
  if (Array.isArray(current)) {
    return current.length > 0;
  } else if (typeof current === 'object' && current !== null) {
    return Object.keys(current).length > 0;
  }
  
  return !!current; // Return true if the value is truthy
};

/**
 * Higher-order component for applying smooth transitions
 * @param {Function} Component - The component to wrap with transitions
 * @param {Number} duration - The transition duration in ms
 */
export const withTransition = (Component, duration = 300) => {
  // This function needs to be fixed for non-JSX environments
  return function WithTransitionWrapper(props) {
    const isVisible = usePageTransition(false, duration);
    return React.createElement('div', {
      className: `page-transition ${isVisible ? 'page-entered' : 'page-entering'}`,
      children: React.createElement(Component, props)
    });
  };
};

/**
 * Handle navigation with transition while preserving state
 * @param {Function} navigate - React Router's navigate function
 * @param {String} path - Path to navigate to
 * @param {Number} delay - Transition delay before navigation
 */
export const navigateWithTransition = (navigate, path, delay = 200) => {
  return function(dispatch) {
    // Mark this page in the cache to avoid refetching
    pageCache.set(path, true);
    
    // Start the transition animations
    dispatch(startNavigation());
    dispatch(startPageTransition());
    
    setTimeout(() => {
      navigate(path);
    }, delay);
  };
};

/**
 * Check if a page has been recently visited (in cache)
 * @param {String} path - The path to check
 * @returns {Boolean} - Whether the page is cached
 */
export const isPageCached = (path) => {
  return pageCache.has(path);
};

/**
 * Clear cache for a specific path
 * @param {String} path - Path to clear from cache
 */
export const clearPageCache = (path) => {
  if (path) {
    pageCache.delete(path);
  } else {
    pageCache.clear();
  }
};

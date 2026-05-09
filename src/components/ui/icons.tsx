import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export const Icons = {
  play: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M3 2.5L11.5 7L3 11.5V2.5Z" fill="currentColor"/>
    </svg>
  ),
  pause: (p: IconProps = {}) => (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" {...p}>
      <rect x="1" y="2" width="3.5" height="10" fill="currentColor"/>
      <rect x="7.5" y="2" width="3.5" height="10" fill="currentColor"/>
    </svg>
  ),
  mic: (p: IconProps = {}) => (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" {...p}>
      <rect x="7" y="2" width="6" height="11" rx="3" fill="currentColor"/>
      <path d="M3 11C3 14.866 6.13401 18 10 18C13.866 18 17 14.866 17 11" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <path d="M10 18V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  arrow: (p: IconProps = {}) => (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" {...p}>
      <path d="M1 5H13M13 5L9 1M13 5L9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  arrowLeft: (p: IconProps = {}) => (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" {...p}>
      <path d="M13 5H1M1 5L5 1M1 5L5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  check: (p: IconProps = {}) => (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" {...p}>
      <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  x: (p: IconProps = {}) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...p}>
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  refresh: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M12 7C12 9.76 9.76 12 7 12C4.7 12 2.78 10.45 2.21 8.36M2 7C2 4.24 4.24 2 7 2C9.3 2 11.22 3.55 11.79 5.64M12 2.5V5.5H9M2 11.5V8.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  spark: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
    </svg>
  ),
  settings: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" fill="none"/>
      <path d="M7 1V3M7 11V13M13 7H11M3 7H1M11.24 2.76L9.83 4.17M4.17 9.83L2.76 11.24M11.24 11.24L9.83 9.83M4.17 4.17L2.76 2.76" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};


import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => {
  return (
    <svg 
      className={className}
      viewBox="0 0 52 52" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M26 2L32.1268 14.3732L46 16.2918L36 26L38.2536 39.7082L26 33.315L13.7464 39.7082L16 26L6 16.2918L19.8732 14.3732L26 2Z" 
            fill="url(#paint0_linear_logo)" 
            stroke="url(#paint1_linear_logo)" 
            strokeWidth="2"/>
      <path d="M26 13L29.0622 19.1868L35.5 20.1459L30.75 24.5L31.873 30.8132L26 27.6565L20.127 30.8132L21.25 24.5L16.5 20.1459L22.9378 19.1868L26 13Z" 
            fill="#FFFFFF"/>
      <defs>
        <linearGradient id="paint0_linear_logo" x1="26" y1="2" x2="26" y2="39.7082" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64FFDA"/>
          <stop offset="1" stopColor="#33D1A2"/>
        </linearGradient>
        <linearGradient id="paint1_linear_logo" x1="26" y1="2" x2="26" y2="39.7082" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0E1DD" stopOpacity="0.5"/>
          <stop offset="1" stopColor="#778DA9"/>
        </linearGradient>
      </defs>
    </svg>
  );
};

export default Logo;
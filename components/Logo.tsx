
import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => {
  return (
    <img 
      src="https://res.cloudinary.com/dymsgltsr/image/upload/v1782824028/Logo_Nexstar.png" 
      alt="Nexstar Logo"
      className={className + " object-contain"}
    />
  );
};

export default Logo;
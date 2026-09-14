import React from 'react';

interface FirebaseConfigGuardProps {
  children: React.ReactNode;
}

export const FirebaseConfigGuard: React.FC<FirebaseConfigGuardProps> = ({ children }) => {
  return <>{children}</>;
};


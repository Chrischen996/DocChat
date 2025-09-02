'use client';

import React from 'react';

const LanguageSwitcher: React.FC = () => {
  // Since we only support one language, this component can be simplified
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">语言</span>
      <span className="text-sm font-medium text-gray-900">中文</span>
    </div>
  );
};

export default LanguageSwitcher;

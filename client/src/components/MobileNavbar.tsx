import React from 'react';
import { BurgerMenu } from './burgerMenu.jsx';

const MobileNavbar = ({ pageName }) => {
    return (
        <header className="bg-card shadow-sm border-b border-gray-200">
               <div className="flex items-center gap-4 px-6 py-4">
                 <div className="flex items-center space-x-3">
                   <BurgerMenu />
                 </div>
                 <h2
                   className="text-2xl font-semibold text-gray-900"
                   data-testid="page-title"
                 >
       {pageName}    
             </h2>
               </div>
             </header>
       
    );
};

export default MobileNavbar;
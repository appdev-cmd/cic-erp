import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CrmLayout } from '../CrmLayout';
import ProductListComponent from '../../ProductList';
import { ROUTES } from '../../../routes/routes';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <CrmLayout>
      <ProductListComponent
        onSelectProduct={(id) => navigate(ROUTES.PRODUCT_DETAIL(id))}
      />
    </CrmLayout>
  );
};

export default ProductsPage;

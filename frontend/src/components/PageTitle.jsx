import { DEFAULT_PAGE_TITLE } from '@/context/constants';
import { useAuthContext } from '@/context/useAuthContext';
import { Helmet } from 'react-helmet-async';

function companyName(user) {
  const name = user?.company?.name;
  return typeof name === 'string' ? name.trim() : '';
}

const PageMetaData = ({
  title,
  exact = false
}) => {
  const { user } = useAuthContext();
  const brand = user ? companyName(user) || DEFAULT_PAGE_TITLE : DEFAULT_PAGE_TITLE;
  const documentTitle = exact ? title : title ? title + ' | ' + brand : brand;
  return <Helmet>
      <title>{documentTitle}</title>
    </Helmet>;
};
export default PageMetaData;
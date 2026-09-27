import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Grid } from 'gridjs-react';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useAuthContext } from '@/context/useAuthContext';
import httpClient from '@/helpers/httpClient';
import { statusBadge } from '@/helpers/statusBadge';

const columns = [{
  id: 'property_type',
  name: 'Property type'
}, {
  id: 'price',
  name: 'Price'
}, {
  id: 'bedrooms',
  name: 'Bedrooms'
}, {
  id: 'bathrooms',
  name: 'Bathrooms'
}, {
  id: 'allowed_nationalities',
  name: 'Allowed nationalities'
}, {
  id: 'furnishing',
  name: 'Furnishing'
}, {
  id: 'maid_room',
  name: 'Maid room'
}, {
  id: 'status',
  name: 'Status',
  formatter: cell => statusBadge(cell)
}];

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatMaidRoom(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 'Yes';
  if (value === false || value === 0 || value === '0' || value === 'false') return 'No';
  return '';
}

function toRow(property) {
  return {
    property_type: property.property_type ?? '',
    price: formatPrice(property.price),
    bedrooms: property.bedrooms ?? '',
    bathrooms: property.bathrooms ?? '',
    allowed_nationalities: property.allowed_nationalities ?? '',
    furnishing: property.furnishing ?? '',
    maid_room: formatMaidRoom(property.maid_room),
    status: property.status ?? ''
  };
}

const PropertiesPage = () => {
  const { user } = useAuthContext();
  const isBroker = user?.role === 'broker';
  const [properties, setProperties] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await httpClient.get(isBroker ? '/api/broker/properties' : '/api/properties');
        if (!active) return;
        const rows = Array.isArray(res.data) ? res.data.map(toRow) : [];
        setProperties(rows);
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load properties.');
        setProperties([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [isBroker]);

  return <>
      <PageMetaData title="Properties" />
      <PageBreadcrumb title="Properties" subName="CRM" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <CardTitle as="h5" className="mb-0">
              Properties
            </CardTitle>
            {!isBroker && <Button as={Link} to="/properties/add">
              Add property
            </Button>}
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {properties === null ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Grid columns={columns} data={properties} search sort fixedHeader height="420px" pagination={{
          limit: 10
        }} />}
        </CardBody>
      </Card>
    </>;
};

export default PropertiesPage;

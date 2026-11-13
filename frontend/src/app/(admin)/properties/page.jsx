import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { h } from 'gridjs';
import { Grid } from 'gridjs-react';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useAuthContext } from '@/context/useAuthContext';
import httpClient from '@/helpers/httpClient';
import { statusBadge } from '@/helpers/statusBadge';

const PROPERTY_PLACEHOLDER = '/property-placeholder.svg';

const listColumns = [{
  id: 'image',
  name: 'Photo',
  sort: false,
  formatter: cell => h('img', {
    src: cell || PROPERTY_PLACEHOLDER,
    alt: '',
    width: 56,
    height: 42,
    style: {
      objectFit: 'cover',
      borderRadius: '4px',
      background: '#e9ecef'
    }
  })
}, {
  id: 'property_type',
  name: 'Property type'
}, {
  id: 'price',
  name: 'Price'
}, {
  id: 'bedrooms',
  name: 'Bedrooms'
}, {
  id: 'furnishing',
  name: 'Furnishing'
}, {
  id: 'available_from',
  name: 'Available from'
}, {
  id: 'status',
  name: 'Status',
  formatter: cell => statusBadge(cell)
}];

const actionColumn = {
  id: 'id',
  name: 'Actions',
  sort: false,
  formatter: cell => h('a', {
    href: '/properties/' + cell + '/edit',
    className: 'btn btn-sm btn-outline-primary'
  }, 'Edit')
};

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function toRow(property) {
  return {
    id: property.id ?? '',
    image: property.image ?? '',
    property_type: property.property_type ?? '',
    price: formatPrice(property.price),
    bedrooms: property.bedrooms ?? '',
    furnishing: property.furnishing ?? '',
    available_from: property.available_from ?? '',
    status: property.status ?? ''
  };
}

const PropertiesPage = () => {
  const { user } = useAuthContext();
  const isBroker = user?.role === 'broker';
  const [properties, setProperties] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    propertyType: '',
    bedrooms: ''
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const columns = isBroker ? listColumns : listColumns.concat(actionColumn);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError('');
        setProperties(null);
        const params = {};
        if (appliedFilters.propertyType.trim()) params.property_type = appliedFilters.propertyType.trim();
        if (appliedFilters.bedrooms !== '') params.bedrooms = appliedFilters.bedrooms;
        const res = await httpClient.get(isBroker ? '/api/broker/properties' : '/api/properties', { params });
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
  }, [isBroker, appliedFilters]);

  const updateFilter = event => {
    const { name, value } = event.target;
    setFilters(current => ({
      ...current,
      [name]: value
    }));
  };

  const applyFilters = event => {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    const emptyFilters = {
      propertyType: '',
      bedrooms: ''
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

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
          <Form onSubmit={applyFilters} className="mb-3">
            <Row className="g-2 align-items-end">
              <Col md={4}>
                <Form.Label>Property type</Form.Label>
                <Form.Control name="propertyType" value={filters.propertyType} onChange={updateFilter} placeholder="Search property type" />
              </Col>
              <Col md={3}>
                <Form.Label>Bedrooms</Form.Label>
                <Form.Control name="bedrooms" type="number" min="0" step="1" value={filters.bedrooms} onChange={updateFilter} placeholder="Any" />
              </Col>
              <Col md={3} className="d-flex gap-2">
                <Button type="submit">Search</Button>
                <Button type="button" variant="outline-secondary" onClick={clearFilters}>
                  Clear
                </Button>
              </Col>
            </Row>
          </Form>
          {error && <Alert variant="danger">{error}</Alert>}
          {properties === null ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Grid columns={columns} data={properties} className={{
          table: 'table table-sm'
        }} sort fixedHeader height="420px" pagination={{
          limit: 10
        }} />}
        </CardBody>
      </Card>
    </>;
};

export default PropertiesPage;

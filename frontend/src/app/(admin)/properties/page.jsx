import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { h } from 'gridjs';
import { Grid } from 'gridjs-react';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useAuthContext } from '@/context/useAuthContext';
import httpClient from '@/helpers/httpClient';
import { mediaUrl } from '@/helpers/mediaUrl';
import { statusBadge } from '@/helpers/statusBadge';

const PROPERTY_PLACEHOLDER = '/property-placeholder.svg';

const listColumns = [{
  id: 'image',
  name: 'Photo',
  sort: false,
  formatter: cell => h('img', {
    src: mediaUrl(cell) || PROPERTY_PLACEHOLDER,
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
  id: 'title',
  name: 'Title'
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

function actionColumn(isBroker, openBrochure) {
  return {
    id: 'actions',
    name: 'Actions',
    sort: false,
    formatter: cell => {
      const propertyId = cell && cell.id;
      const hasPdf = Boolean(cell && cell.hasPdf);
      const buttons = [];
      if (!isBroker) {
        buttons.push(h('a', {
          href: '/properties/' + propertyId + '/edit',
          className: 'btn btn-sm btn-outline-primary'
        }, 'Edit'));
      }
      buttons.push(h('button', {
        type: 'button',
        className: 'btn btn-sm btn-outline-secondary',
        disabled: !hasPdf,
        title: hasPdf ? 'View PDF' : 'Save the property to generate a brochure.',
        onClick: () => {
          if (hasPdf) openBrochure(propertyId, false);
        }
      }, 'View PDF'));
      buttons.push(h('button', {
        type: 'button',
        className: 'btn btn-sm btn-outline-secondary',
        disabled: !hasPdf,
        title: hasPdf ? 'Download PDF' : 'Save the property to generate a brochure.',
        onClick: () => {
          if (hasPdf) openBrochure(propertyId, true);
        }
      }, 'Download PDF'));
      return h('div', { className: 'd-flex flex-wrap gap-1' }, buttons);
    }
  };
}

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
    title: property.title ?? '',
    property_type: property.property_type ?? '',
    price: formatPrice(property.price),
    bedrooms: property.bedrooms ?? '',
    furnishing: property.furnishing ?? '',
    available_from: property.available_from ?? '',
    status: property.status ?? '',
    actions: {
      id: property.id ?? '',
      hasPdf: Boolean(property.pdf_path)
    }
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
  const [pdfMessage, setPdfMessage] = useState('');
  const openingRef = useRef(false);
  const openBrochure = useCallback(async (id, download) => {
    if (!id || openingRef.current) return;
    openingRef.current = true;
    setPdfMessage(download ? 'Preparing PDF download…' : 'Opening PDF…');
    setError('');
    try {
      const endpoint = (isBroker ? '/api/broker/properties/' : '/api/properties/') + id + '/brochure';
      const response = await httpClient.get(endpoint, {
        params: download ? { download: 1 } : undefined,
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'property-' + id + '-brochure.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, '_blank', 'noopener');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      let message = 'Unable to open the brochure.';
      const data = e.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text()).error || message;
        } catch {
          message = 'Unable to open the brochure.';
        }
      } else if (e.response?.data?.error) {
        message = e.response.data.error;
      }
      setError(message);
    } finally {
      openingRef.current = false;
      setPdfMessage('');
    }
  }, [isBroker]);
  const columns = useMemo(() => listColumns.concat(actionColumn(isBroker, openBrochure)), [isBroker, openBrochure]);

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
          {pdfMessage && <div className="d-flex align-items-center gap-2 mb-3 text-muted">
              <Spinner animation="border" size="sm" role="status" />
              <span>{pdfMessage}</span>
            </div>}
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

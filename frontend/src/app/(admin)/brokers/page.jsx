import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { h } from 'gridjs';
import { Grid } from 'gridjs-react';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import httpClient from '@/helpers/httpClient';
import { statusBadge } from '@/helpers/statusBadge';

const columns = [{
  id: 'profile_picture',
  name: 'Photo',
  sort: false,
  formatter: cell => {
    if (!cell) return '';
    return h('img', {
      src: cell,
      alt: '',
      width: 40,
      height: 40,
      style: {
        objectFit: 'cover',
        borderRadius: '4px'
      }
    });
  }
}, {
  id: 'name',
  name: 'Name'
}, {
  id: 'email',
  name: 'Email'
}, {
  id: 'mobile',
  name: 'Mobile'
}, {
  id: 'license_number',
  name: 'License'
}, {
  id: 'status',
  name: 'Status',
  formatter: cell => statusBadge(cell)
}, {
  id: 'email_verified',
  name: 'Email verified'
}, {
  id: 'mobile_verified',
  name: 'Mobile verified'
}, {
  id: 'id',
  name: 'Actions',
  sort: false,
  formatter: cell => h('a', {
    href: '/brokers/' + cell + '/edit',
    className: 'btn btn-sm btn-outline-primary'
  }, 'Edit')
}];

function formatVerified(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 'Yes';
  if (value === false || value === 0 || value === '0' || value === 'false') return 'No';
  return '';
}

function toRow(broker) {
  return {
    id: broker.id ?? '',
    profile_picture: broker.profile_picture ?? '',
    name: broker.name ?? '',
    email: broker.email ?? '',
    mobile: broker.mobile ?? '',
    license_number: broker.license_number ?? '',
    status: broker.status ?? '',
    email_verified: formatVerified(broker.email_verified),
    mobile_verified: formatVerified(broker.mobile_verified)
  };
}

const BrokersPage = () => {
  const [brokers, setBrokers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await httpClient.get('/api/brokers');
        if (!active) return;
        const rows = Array.isArray(res.data) ? res.data.map(toRow) : [];
        setBrokers(rows);
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load brokers.');
        setBrokers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return <>
      <PageMetaData title="Brokers" />
      <PageBreadcrumb title="Brokers" subName="CRM" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <CardTitle as="h5" className="mb-0">
              Brokers
            </CardTitle>
            <Button as={Link} to="/brokers/add">
              Add broker
            </Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {brokers === null ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Grid columns={columns} data={brokers} search sort fixedHeader height="420px" pagination={{
          limit: 10
        }} />}
        </CardBody>
      </Card>
    </>;
};

export default BrokersPage;

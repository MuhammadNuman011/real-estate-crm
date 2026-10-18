import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { h } from 'gridjs';
import { Grid } from 'gridjs-react';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import httpClient from '@/helpers/httpClient';
import { statusBadge } from '@/helpers/statusBadge';

function idImage(cell) {
  if (!cell) return '';
  return h('img', {
    src: cell,
    alt: '',
    width: 56,
    height: 36,
    style: {
      objectFit: 'cover',
      borderRadius: '4px'
    }
  });
}

const columns = [{
  id: 'name',
  name: 'Name'
}, {
  id: 'email',
  name: 'Email'
}, {
  id: 'mobile',
  name: 'Mobile'
}, {
  id: 'national_id_front',
  name: 'ID front',
  sort: false,
  formatter: idImage
}, {
  id: 'national_id_back',
  name: 'ID back',
  sort: false,
  formatter: idImage
}, {
  id: 'status',
  name: 'Status',
  formatter: cell => statusBadge(cell)
}, {
  id: 'id',
  name: 'Actions',
  sort: false,
  formatter: cell => h('a', {
    href: '/owners/' + cell + '/edit',
    className: 'btn btn-sm btn-outline-primary'
  }, 'Edit')
}];

function toRow(owner) {
  return {
    id: owner.id ?? '',
    name: owner.name ?? '',
    email: owner.email ?? '',
    mobile: owner.mobile ?? '',
    national_id_front: owner.national_id_front ?? '',
    national_id_back: owner.national_id_back ?? '',
    status: owner.status ?? ''
  };
}

const OwnersPage = () => {
  const [owners, setOwners] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await httpClient.get('/api/owners');
        if (!active) return;
        const rows = Array.isArray(res.data) ? res.data.map(toRow) : [];
        setOwners(rows);
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load owners.');
        setOwners([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return <>
      <PageMetaData title="Owners" />
      <PageBreadcrumb title="Owners" subName="CRM" />
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <CardTitle as="h5" className="mb-0">
              Property owners
            </CardTitle>
            <Button as={Link} to="/owners/add">
              Add owner
            </Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {owners === null ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Grid columns={columns} data={owners} className={{
          table: 'table table-sm'
        }} search sort fixedHeader height="420px" pagination={{
          limit: 10
        }} />}
        </CardBody>
      </Card>
    </>;
};

export default OwnersPage;

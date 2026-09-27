import { useEffect, useState } from 'react';
import { Alert, Card, CardBody, CardTitle, Spinner } from 'react-bootstrap';
import { Grid } from 'gridjs-react';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import httpClient from '@/helpers/httpClient';

const columns = [{
  id: 'id',
  name: 'ID',
  width: '70px'
}, {
  id: 'name',
  name: 'Name'
}, {
  id: 'email',
  name: 'Email'
}, {
  id: 'adminid',
  name: 'Admin ID'
}, {
  id: 'mobile',
  name: 'Mobile'
}, {
  id: 'status',
  name: 'Status'
}, {
  id: 'createdAt',
  name: 'Created',
  formatter: cell => formatDate(cell)
}, {
  id: 'updatedAt',
  name: 'Updated',
  formatter: cell => formatDate(cell)
}];

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function toRow(company) {
  return {
    id: company.id ?? '',
    name: company.name ?? '',
    email: company.email ?? '',
    adminid: company.adminid ?? '',
    mobile: company.mobile || '',
    status: company.status ?? '',
    createdAt: company.createdAt ?? '',
    updatedAt: company.updatedAt ?? ''
  };
}

const CompaniesPage = () => {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await httpClient.get('/api/company');
        if (!active) return;
        const rows = Array.isArray(res.data) ? res.data.map(toRow) : [];
        setCompanies(rows);
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load companies.');
        setCompanies([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return <>
      <PageMetaData title="Companies" />
      <PageBreadcrumb title="Companies" subName="CRM" />
      <Card>
        <CardBody>
          <CardTitle as="h5" className="mb-3">
            Companies
          </CardTitle>
          {error && <Alert variant="danger">{error}</Alert>}
          {companies === null ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Grid columns={columns} data={companies} search sort fixedHeader height="420px" pagination={{
          limit: 10
        }} />}
        </CardBody>
      </Card>
    </>;
};

export default CompaniesPage;

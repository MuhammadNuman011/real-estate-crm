import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardBody, CardTitle, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useAuthContext } from '@/context/useAuthContext';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';
import { IMAGE_FILE_ACCEPT, prepareImageFile } from '@/helpers/imageFile';
import { mediaUrl } from '@/helpers/mediaUrl';

const schema = yup.object({
  name: yup.string().trim().required('Name is required').max(255, 'Name must be 255 characters or fewer'),
  email: yup.string().trim().email('Email must be valid').required('Email is required').max(255, 'Email must be 255 characters or fewer'),
  adminid: yup.string().trim().required('Admin ID is required').max(255, 'Admin ID must be 255 characters or fewer'),
  mobile: yup.string().trim().max(255, 'Mobile must be 255 characters or fewer').default('')
});

const defaultValues = {
  name: '',
  email: '',
  adminid: '',
  mobile: ''
};

function statusLabel(status) {
  return String(status || 'inactive').toLowerCase() === 'active' ? 'Active' : 'Inactive';
}

const CompanyProfilePage = () => {
  const { user, saveSession } = useAuthContext();
  const { showNotification } = useNotificationContext();
  const [loading, setLoading] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoError, setLogoError] = useState('');
  const [keepLogo, setKeepLogo] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues
  });

  const applyCompany = company => {
    reset({
      name: company.name ?? '',
      email: company.email ?? '',
      adminid: company.adminid ?? '',
      mobile: company.mobile ?? ''
    });
    setStatus(company.status || '');
    setKeepLogo(company.logo || '');
    setLogoPreview(company.logo || '');
    setLogoFile(null);
    setRemoveLogo(false);
    setLogoError('');
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await httpClient.get('/api/company');
        if (!active) return;
        const company = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!company) {
          setError('Company not found.');
          return;
        }
        reset({
          name: company.name ?? '',
          email: company.email ?? '',
          adminid: company.adminid ?? '',
          mobile: company.mobile ?? ''
        });
        setStatus(company.status || '');
        setKeepLogo(company.logo || '');
        setLogoPreview(company.logo || '');
        setLogoFile(null);
        setRemoveLogo(false);
        setLogoError('');
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load the company profile.');
      } finally {
        if (active) setLoadingCompany(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reset]);

  const onLogoChange = async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const prepared = await prepareImageFile(file);
    event.target.value = '';
    if (prepared.error) {
      setLogoError(prepared.error);
      return;
    }
    setLogoFile(prepared.dataUrl);
    setLogoPreview(prepared.dataUrl);
    setRemoveLogo(false);
    setLogoError('');
  };

  const onRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setKeepLogo('');
    setRemoveLogo(true);
    setLogoError('');
  };

  const onCancel = () => {
    setError('');
    setLogoError('');
    setLoadingCompany(true);
    httpClient.get('/api/company').then(res => {
      const company = Array.isArray(res.data) ? res.data[0] : res.data;
      if (company) applyCompany(company);
    }).catch(e => {
      setError(e.response?.data?.error || 'Unable to load the company profile.');
    }).finally(() => {
      setLoadingCompany(false);
    });
  };

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError('');
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      adminid: values.adminid.trim(),
      mobile: values.mobile.trim()
    };
    if (logoFile) payload.logo = logoFile;
    else if (removeLogo) payload.logo = '';

    try {
      const res = await httpClient.patch('/api/company', payload);
      const company = res.data || {};
      applyCompany(company);
      saveSession({
        ...(user || {}),
        role: user?.role || 'company',
        company: {
          ...(user?.company || {}),
          ...company
        }
      });
      showNotification({
        message: 'Company profile updated.',
        variant: 'success'
      });
    } catch (e) {
      const data = e.response?.data;
      const fields = data?.fields;
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([name, message]) => {
          if (name === 'logo') {
            setLogoError(message);
            return;
          }
          setFieldError(name, { message });
        });
      }
      setError(data?.error || 'Unable to update the company profile.');
    } finally {
      setLoading(false);
    }
  });

  return <>
      <PageMetaData title="Company profile" />
      <PageBreadcrumb title="Company profile" subName="CRM" />
      <Card>
        <CardBody>
          <CardTitle as="h5" className="mb-3">
            Company profile
          </CardTitle>
          {error && <Alert variant="danger">{error}</Alert>}
          {loadingCompany ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Form onSubmit={onSubmit} noValidate>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Company name</Form.Label>
                    <Form.Control type="text" {...register('name')} isInvalid={Boolean(errors.name)} />
                    <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" {...register('email')} isInvalid={Boolean(errors.email)} />
                    <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Admin ID</Form.Label>
                    <Form.Control type="text" {...register('adminid')} isInvalid={Boolean(errors.adminid)} />
                    <Form.Control.Feedback type="invalid">{errors.adminid?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Mobile</Form.Label>
                    <Form.Control type="text" {...register('mobile')} isInvalid={Boolean(errors.mobile)} />
                    <Form.Control.Feedback type="invalid">{errors.mobile?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <div>
                      <Badge bg={String(status).toLowerCase() === 'active' ? 'success' : 'secondary'}>
                        {statusLabel(status)}
                      </Badge>
                    </div>
                    <div className="text-muted small mt-1">Status is managed separately and cannot be changed here.</div>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Company logo</Form.Label>
                    <Form.Control type="file" accept={IMAGE_FILE_ACCEPT} onChange={onLogoChange} isInvalid={Boolean(logoError)} />
                    {logoError ? <div className="invalid-feedback d-block">{logoError}</div> : null}
                    <div className="text-muted small mt-1">PNG, JPG, JPEG, or WebP. Large photos are resized to fit 5 MB. Leave this empty to keep the current logo.</div>
                    {logoPreview ? <div className="mt-2 d-flex align-items-center gap-3">
                        <img src={mediaUrl(logoPreview)} alt="Company logo preview" width="96" height="96" style={{ objectFit: 'contain', borderRadius: '4px', background: '#f5f6f8' }} />
                        <Button type="button" variant="outline-danger" size="sm" onClick={onRemoveLogo}>
                          Remove logo
                        </Button>
                      </div> : <div className="text-muted small mt-2">No logo uploaded.</div>}
                  </Form.Group>
                </Col>
                <Col xs={12} className="d-flex flex-wrap gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                    Save
                  </Button>
                  <Button type="button" variant="light" onClick={onCancel} disabled={loading}>
                    Cancel
                  </Button>
                </Col>
              </Row>
            </Form>}
        </CardBody>
      </Card>
    </>;
};

export default CompanyProfilePage;

import PasswordFormInput from '@/components/form/PasswordFormInput';
import TextFormInput from '@/components/form/TextFormInput';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { Alert, Button, FormCheck, Spinner } from 'react-bootstrap';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';

const signUpSchema = yup.object({
  name: yup.string().trim().required('Please enter the company name'),
  email: yup.string().trim().email('Please enter a valid email').required('Please enter your email'),
  adminid: yup.string().trim().required('Please enter an admin ID'),
  mobile: yup.string().trim().default(''),
  password: yup.string().required('Please enter your password').min(8, 'Password must be at least 8 characters'),
  terms: yup.boolean().oneOf([true], 'Please accept the terms and conditions')
});

const SignUpForm = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotificationContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    control,
    handleSubmit,
    setError: setFieldError
  } = useForm({
    resolver: yupResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      adminid: '',
      mobile: '',
      password: '',
      terms: false
    }
  });

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError('');
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      adminid: values.adminid.trim(),
      password: values.password
    };
    if (values.mobile?.trim()) payload.mobile = values.mobile.trim();

    try {
      await httpClient.post('/api/company', payload);
      showNotification({
        message: 'Company registered. You can sign in after the account is activated.',
        variant: 'success'
      });
      navigate('/auth/sign-in');
    } catch (e) {
      const data = e.response?.data;
      const fields = data?.fields;
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([name, message]) => {
          setFieldError(name, { message });
        });
      }
      const message = data?.error || 'Unable to register the company.';
      if (/email/i.test(message)) setFieldError('email', { message });
      if (/admin id/i.test(message)) setFieldError('adminid', { message });
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return <form className="authentication-form" onSubmit={onSubmit} noValidate>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <TextFormInput control={control} name="name" containerClassName="mb-3" label="Company name" id="name" placeholder="Enter the company name" />
      <TextFormInput control={control} name="email" containerClassName="mb-3" label="Email" id="email-id" placeholder="Enter your email" />
      <TextFormInput control={control} name="adminid" containerClassName="mb-3" label="Admin ID" id="admin-id" placeholder="Enter an admin ID" />
      <TextFormInput control={control} name="mobile" containerClassName="mb-3" label="Mobile" id="mobile-id" placeholder="Enter a mobile number" />
      <PasswordFormInput control={control} name="password" containerClassName="mb-3" placeholder="Enter your password" id="password-id" label="Password" />
      <Controller name="terms" control={control} render={({ field, fieldState }) => <div className="mb-3">
            <FormCheck id="termAndCondition" label="I accept Terms and Condition" checked={Boolean(field.value)} onChange={event => field.onChange(event.target.checked)} isInvalid={Boolean(fieldState.error)} feedback={fieldState.error?.message} feedbackType="invalid" />
          </div>} />
      <div className="mb-1 text-center d-grid">
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          Sign Up
        </Button>
      </div>
    </form>;
};

export default SignUpForm;

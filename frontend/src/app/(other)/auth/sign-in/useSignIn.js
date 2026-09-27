import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as yup from 'yup';
import { useAuthContext } from '@/context/useAuthContext';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';
const useSignIn = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {
    saveSession
  } = useAuthContext();
  const [searchParams] = useSearchParams();
  const {
    showNotification
  } = useNotificationContext();
  const loginFormSchema = yup.object({
    adminid: yup.string().trim().required('Please enter your admin ID'),
    password: yup.string().required('Please enter your password')
  });
  const {
    control,
    handleSubmit
  } = useForm({
    resolver: yupResolver(loginFormSchema),
    defaultValues: {
      adminid: '',
      password: ''
    }
  });
  const redirectUser = () => {
    const redirectLink = searchParams.get('redirectTo');
    if (redirectLink) navigate(redirectLink);else navigate('/dashboard/analytics');
  };
  const login = handleSubmit(async values => {
    setLoading(true);
    try {
      const res = await httpClient.post('/api/company/login', {
        adminid: values.adminid.trim(),
        password: values.password
      });
      if (res.data?.token) {
        saveSession({
          ...(res.data ?? {}),
          role: 'company',
          token: res.data.token
        });
        redirectUser();
        showNotification({
          message: 'Successfully logged in. Redirecting....',
          variant: 'success'
        });
      }
    } catch (e) {
      const data = e.response?.data;
      const fieldMessage = data?.fields ? Object.values(data.fields).filter(Boolean).join(' ') : '';
      showNotification({
        message: fieldMessage || data?.error || 'Unable to log in. Please try again.',
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  });
  return {
    loading,
    login,
    control
  };
};
export default useSignIn;
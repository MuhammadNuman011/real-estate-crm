import PasswordFormInput from '@/components/form/PasswordFormInput';
import TextFormInput from '@/components/form/TextFormInput';
import { Button } from 'react-bootstrap';
import useBrokerSignIn from './useBrokerSignIn';

const LoginForm = () => {
  const { loading, login, control } = useBrokerSignIn();
  return <form onSubmit={login} className="authentication-form">
      <TextFormInput control={control} name="email" containerClassName="mb-3" label="Email" id="broker-email" type="email" placeholder="Enter your email" />

      <PasswordFormInput control={control} name="password" containerClassName="mb-3" placeholder="Enter your password" id="broker-password" label="Password" />

      <div className="mb-1 text-center d-grid">
        <Button variant="primary" type="submit" disabled={loading}>
          Sign In
        </Button>
      </div>
    </form>;
};

export default LoginForm;

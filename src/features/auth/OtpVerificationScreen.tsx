import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const OtpVerificationScreen: React.FC = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const navigate = useNavigate();

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerify = () => {
    navigate('/passenger');
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center items-center p-margin-mobile text-center">
      <div className="w-full max-w-sm space-y-lg bg-surface-container-lowest p-lg sm:p-xl rounded-2xl border border-outline-variant/30 shadow-sm">
        <PrimaryLogo className="h-10 w-auto mx-auto mb-2" />
        <span className="material-symbols-outlined text-5xl text-secondary">phonelink_lock</span>
        <h1 className="font-headline-lg text-on-surface">Enter OTP Code</h1>
        <p className="font-body-md text-on-surface-variant">
          Enter the 6-digit verification code sent to your phone number.
        </p>

        <div className="flex justify-center gap-2 py-2">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              id={`otp-input-${idx}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              className="w-11 h-14 text-center font-label-mono text-xl border border-outline-variant rounded-xl bg-surface-container-low focus:border-primary focus:outline-none"
            />
          ))}
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={handleVerify}
          disabled={otp.some((d) => !d)}
        >
          Verify Code
        </Button>
      </div>
    </div>
  );
};

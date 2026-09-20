// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WelcomeScreenV2 } from '../features/auth/WelcomeScreenV2';

describe('WelcomeScreenV2 Refactored Landing Page', () => {
  it('renders complete semantic header, main, sections, and footer', () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomeScreenV2 />
      </MemoryRouter>
    );

    expect(container.querySelector('header')).toBeTruthy();
    expect(container.querySelector('main')).toBeTruthy();
    expect(container.querySelector('footer')).toBeTruthy();

    // Section IDs
    expect(container.querySelector('#why-mwendo')).toBeTruthy();
    expect(container.querySelector('#mobility')).toBeTruthy();
    expect(container.querySelector('#ecosystem')).toBeTruthy();
    expect(container.querySelector('#for-passengers')).toBeTruthy();
    expect(container.querySelector('#safety')).toBeTruthy();
  });

  it('renders required navigation links and data-path attributes', () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomeScreenV2 />
      </MemoryRouter>
    );

    expect(container.querySelector('[data-path="home"]')).toBeTruthy();
    expect(container.querySelector('[data-path="why-mwendo"]')).toBeTruthy();
    expect(container.querySelector('[data-path="mobility"]')).toBeTruthy();
    expect(container.querySelector('[data-path="for-passengers"]')).toBeTruthy();
    expect(container.querySelector('[data-path="for-saccos"]')).toBeTruthy();
    expect(container.querySelector('[data-path="ecosystem"]')).toBeTruthy();
    expect(container.querySelector('[data-path="safety"]')).toBeTruthy();
    expect(container.querySelector('[data-path="sign-in"]')).toBeTruthy();
    expect(container.querySelector('[data-path="get-started"]')).toBeTruthy();
  });

  it('renders local image assets without external temporary URLs', () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomeScreenV2 />
      </MemoryRouter>
    );

    const images = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(images).toContain('/logo-light.png');
    expect(images).toContain('/images/hero-matatu.jpg');
    expect(images).toContain('/images/corridor-routes.jpg');
    expect(images).toContain('/images/ecosystem-interchange.jpg');
    expect(images).toContain('/images/passenger-experience.jpg');
    expect(images).toContain('/images/vehicle-verification.jpg');

    images.forEach((src) => {
      expect(src).not.toMatch(/googleusercontent\.com/);
    });
  });

  it('displays the headline and civic transit branding', () => {
    render(
      <MemoryRouter>
        <WelcomeScreenV2 />
      </MemoryRouter>
    );

    expect(screen.getByText(/Smarter, safer journeys across/i)).toBeTruthy();
    expect(screen.getByText(/Civic Transit OS/i)).toBeTruthy();
    expect(screen.getByText(/MWENDO \/ KENYAN MOBILITY PLATFORM/i)).toBeTruthy();
  });
});


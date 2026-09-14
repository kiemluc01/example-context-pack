import { INestApplication, ValidationPipe } from '@nestjs/common';
import { configureApp } from './app.setup';

describe('configureApp', () => {
  it('sets the API prefix, cookie parsing, strict validation and hides the framework header', () => {
    const express = { disable: jest.fn() };
    const app = {
      setGlobalPrefix: jest.fn(),
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
      getHttpAdapter: () => ({ getInstance: () => express }),
    };

    configureApp(app as unknown as INestApplication);

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.use).toHaveBeenCalledWith(expect.any(Function));
    const [pipe] = app.useGlobalPipes.mock.calls[0];
    expect(pipe).toBeInstanceOf(ValidationPipe);
    expect(pipe).toMatchObject({
      isTransformEnabled: true,
      validatorOptions: { whitelist: true, forbidNonWhitelisted: true },
    });
    expect(express.disable).toHaveBeenCalledWith('x-powered-by');
  });
});

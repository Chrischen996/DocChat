'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useApp();
  const [apiKey, setApiKey] = useState(state.settings.apiKey);
  const [doubaoApiKey, setDoubaoApiKey] = useState(state.settings.doubaoApiKey);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidatingDoubao, setIsValidatingDoubao] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);
  const [doubaoValidationResult, setDoubaoValidationResult] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);
  const [settings, setSettings] = useState({
    defaultModel: state.settings.defaultModel,
    defaultResolution: state.settings.defaultResolution,
    defaultDuration: state.settings.defaultDuration,
    defaultAspectRatio: state.settings.defaultAspectRatio,
  });

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setValidationResult({
        isValid: false,
        message: 'Please enter an API key',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const result = await response.json();

      setValidationResult({
        isValid: result.valid,
        message: result.valid ? 'Fal.ai API key is valid!' : result.error || 'Invalid API key',
      });
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: 'Failed to validate API key. Please check your connection.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const validateDoubaoApiKey = async () => {
    if (!doubaoApiKey.trim()) {
      setDoubaoValidationResult({
        isValid: false,
        message: 'Please enter a Doubao API key',
      });
      return;
    }

    setIsValidatingDoubao(true);
    setDoubaoValidationResult(null);

    try {
      const response = await fetch('/api/validate-doubao-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: doubaoApiKey.trim() }),
      });

      const result = await response.json();

      setDoubaoValidationResult({
        isValid: result.valid,
        message: result.valid ? 'Doubao API key is valid!' : result.error || 'Invalid API key',
      });
    } catch (error) {
      setDoubaoValidationResult({
        isValid: false,
        message: 'Failed to validate Doubao API key. Please check your connection.',
      });
    } finally {
      setIsValidatingDoubao(false);
    }
  };

  const handleSave = () => {
    // Save API keys
    dispatch({ type: 'SET_API_KEY', payload: apiKey.trim() });
    dispatch({ type: 'SET_DOUBAO_API_KEY', payload: doubaoApiKey.trim() });

    // Save other settings
    dispatch({
      type: 'SET_SETTINGS',
      payload: settings,
    });

    onClose();
  };

  const resolutionOptions = [
    { value: '480p', label: '480p (Lite)' },
    { value: '720p', label: '720p (Lite)' },
    { value: '1080p', label: '1080p (Pro)' },
  ];

  const durationOptions = [
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' },
  ];

  const aspectRatioOptions = [
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '1:1', label: '1:1 (Square)' },
  ];

  const modelOptions = [
    { value: 'fal-ai', label: 'Fal.ai Seedance' },
    { value: 'doubao', label: 'ByteDance Doubao' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="lg">
      <div className="space-y-6">
        {/* API Key Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">API Keys</h3>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">
                  API Keys Required
                </h4>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Get your API keys from{' '}
                    <a
                      href="https://fal.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-900"
                    >
                      fal.ai
                    </a>
                    {' '}and{' '}
                    <a
                      href="https://ark.cn-beijing.volces.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-900"
                    >
                      火山方舟 (Ark)
                    </a>
                    {' '}for Doubao access
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              label="Fal.ai API Key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Fal.ai API key"
              helperText="Your Fal.ai API key is used to authenticate your requests to the Fal.ai API."
              showPasswordToggle={true}
            />

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={validateApiKey}
                loading={isValidating}
                disabled={!apiKey.trim()}
              >
                Validate
              </Button>

              {validationResult && (
                <div
                  className={`text-sm ${
                    validationResult.isValid ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {validationResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Doubao API Key */}
          <div className="space-y-2">
            <Input
              label="Doubao API Key"
              type="password"
              value={doubaoApiKey}
              onChange={(e) => setDoubaoApiKey(e.target.value)}
              placeholder="Enter your Doubao API key from Ark platform"
              helperText="Get your Doubao API key from 火山方舟 (Ark) platform at ark.cn-beijing.volces.com. This key is used to access ByteDance's Doubao Seedance model."
              showPasswordToggle={true}
            />

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={validateDoubaoApiKey}
                loading={isValidatingDoubao}
                disabled={!doubaoApiKey.trim()}
              >
                Validate
              </Button>

              {doubaoValidationResult && (
                <div
                  className={`text-sm ${
                    doubaoValidationResult.isValid ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {doubaoValidationResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Default Settings Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Default Settings</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Model"
              value={settings.defaultModel}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultModel: e.target.value as any,
                })
              }
              options={modelOptions}
            />

            <Select
              label="Resolution"
              value={settings.defaultResolution}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultResolution: e.target.value as any,
                })
              }
              options={resolutionOptions}
            />

            <Select
              label="Duration"
              value={settings.defaultDuration}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultDuration: e.target.value as any,
                })
              }
              options={durationOptions}
            />

            <Select
              label="Aspect Ratio"
              value={settings.defaultAspectRatio}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultAspectRatio: e.target.value as any,
                })
              }
              options={aspectRatioOptions}
            />
          </div>
        </div>

        {/* Cost Information */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-yellow-800">
                Cost Information
              </h4>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  • 1080p Pro: ~$0.74 per 5-second video<br />
                  • 720p Lite: ~$0.18 per 5-second video<br />
                  • Monitor your usage to manage costs
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default Settings;

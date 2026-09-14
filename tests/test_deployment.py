import importlib.util
import tempfile
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('deployment', ROOT / 'scripts/check_deployment.py')
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)

class ConfigurationTests(unittest.TestCase):
    def test_incomplete_configuration_fails_without_showing_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'env').write_text('MESTHI_EDGE_NETWORK=edge\n')
            (path / 'auth').write_text((ROOT / 'deploy/oauth2-proxy.cfg.example').read_text().replace('CHANGE_ME_CLIENT_SECRET', 'never-print-this-secret'))
            (path / 'redis').write_text((ROOT / 'deploy/redis.conf.example').read_text())
            errors = deployment.validate(path / 'env', path / 'auth', path / 'redis')
            self.assertTrue(errors)
            self.assertNotIn('never-print-this-secret', '\n'.join(errors))
    def test_missing_files_are_explicit_blockers(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing'
            self.assertEqual(len(deployment.validate(path, path, path)), 3)

if __name__ == '__main__':
    unittest.main()

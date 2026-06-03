import unittest

from tester_qa.executor import CommandExecutor


class ExecutionEngineTests(unittest.TestCase):
    def test_successful_command_returns_structured_result(self) -> None:
        result = CommandExecutor(default_timeout_seconds=5).run("printf hello")

        self.assertTrue(result.success)
        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.stdout, "hello")
        self.assertEqual(result.to_dict()["command"], "printf hello")

    def test_failed_command_is_not_silent(self) -> None:
        result = CommandExecutor(default_timeout_seconds=5).run("printf failure >&2; exit 7")

        self.assertFalse(result.success)
        self.assertEqual(result.exit_code, 7)
        self.assertIn("failure", result.stderr)

    def test_timeout_is_bounded(self) -> None:
        result = CommandExecutor(default_timeout_seconds=1).run("sleep 2", timeout_seconds=1)

        self.assertFalse(result.success)
        self.assertTrue(result.timed_out)
        self.assertEqual(result.exit_code, 124)

    def test_malformed_timeout_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            CommandExecutor(default_timeout_seconds=0)


if __name__ == "__main__":
    unittest.main()

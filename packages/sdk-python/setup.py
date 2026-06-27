from setuptools import setup, find_packages
import os

with open(os.path.join(os.path.dirname(__file__), 'README.md'), encoding='utf-8') as f:
    long_description = f.read()

setup(
    name="usetraceforge",
    version="1.0.2",
    packages=find_packages(),
    install_requires=[
        "requests>=2.31.0"
    ],
    author="Khushal Patil",
    description="TraceForge Python SDK for unhandled panic logging",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/khushalp2004/TraceForge"
)

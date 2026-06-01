from setuptools import setup, find_packages

setup(
    name="traceforge",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "requests>=2.31.0"
    ],
    author="Khushal Patil",
    description="TraceForge Python SDK for unhandled panic logging",
    url="https://github.com/khushalp2004/TraceForge"
)

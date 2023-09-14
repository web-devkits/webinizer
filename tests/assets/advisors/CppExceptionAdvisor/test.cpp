#include <iostream>

int main() {
    try {
        int age;
        std::cout << "Enter your age: ";
        std::cin >> age;

        if (age < 0) {
            throw "Age cannot be negative";
        }

        std::cout << "Your age is: " << age << std::endl;
    } catch (const char* errorMessage) {
        std::cerr << "Error: " << errorMessage << std::endl;
    }

    return 0;
}
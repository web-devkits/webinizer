cmake_minimum_required(VERSION 3.12)
project(MyProject)


find_package(OpenGL REQUIRED)
find_package(GLEW REQUIRED)
find_package(GLUT REQUIRED)


add_executable(my_program src/main.c)


target_link_libraries(my_program PRIVATE ${OPENGL_LIBRARIES} GLEW::GLEW ${GLUT_LIBRARY})
